// Base class for hero abilities. Per documents/v3_abilities.md, each
// active ability is a subclass under this directory; per-class rosters
// list the subclasses in profile.abilities and BaseHero.applyProfile
// instantiates them. The hero owns the instances so per-ability
// cooldown counters live with the hero, not the class definition.
//
// Dispatch lives in HeroController.onAbilityKey: it calls canActivate(),
// resolves the target via resolveTarget(this.target, ...), debits cost,
// starts cooldown, then calls activate(hero, target). Subclasses
// override activate() and declare their cost / cooldown / range / target
// / icon as instance fields.

import Phaser from 'phaser'
import { empowerDamage } from '../../abilities/empower.js'

// Fields the progression snapshot must never capture/restore: the hero ref,
// runtime state, and the progression bookkeeping/definitions themselves.
const PROGRESSION_INTERNAL = new Set([
    'hero', 'cooldownRemaining', '_baseStats',
    'level', 'maxLevel', 'levelBoosts',
    'augments', 'augmentLevel', 'chosenAugment',
    'traits', 'traitLevel', 'maxTraits', 'equippedTraits',
])

// Clone a tunable value for the base snapshot / restore. Deep-copies plain CONFIG
// objects (shape {kind,length,spread}, cost {ap,mp}) and arrays so nested
// mutations like `a.shape.length = 4` can't corrupt the captured base — but keeps
// status TEMPLATES (plain objects holding functions, e.g. the `acid`/`slow` tags)
// by reference, since Taggable matches them by identity/toString.
function cloneTunable(value) {
    if (Array.isArray(value)) return value.slice()
    if (value && typeof value === 'object' && value.constructor === Object) {
        const holdsFunctions = Object.values(value).some(v => typeof v === 'function')
        return holdsFunctions ? value : { ...value }
    }
    return value
}

export default class Ability {
    name = 'Unnamed'
    icon = 0
    description = ''
    cost = { ap: 1, mp: 0 }
    cooldown = 0
    range = 0
    // AoE blast radius (chebyshev) for the `aoeTile` target mode — the click
    // resolves a footprint of this radius around the chosen tile. Ignored by
    // non-AoE target modes.
    radius = 1
    // For aoeTile WALL abilities: length of the line laid perpendicular to the
    // cast direction. >0 makes the targeting preview draw the wall line instead
    // of the radius footprint. 0 = not a wall.
    wallLength = 0
    // Channeled "invocation" abilities (the Invoking/Invocation root mechanic):
    // toggled on, then auto-fire tick(hero, target) each round as the hero's SOLE
    // action until the target dies, the caster is disabled, or it's toggled off.
    // invokeVerb is the per-ability flavor name ("siphoning", "channeling", …) —
    // all share the Invocation root. breaksOnLineOfSight snaps the channel when
    // the target leaves range / line-of-sight (per-ability; some won't).
    channeled = false
    invokeVerb = 'invoking'
    breaksOnLineOfSight = true
    // FRAME-PACED channels: tick() is driven every frame by World.update rather
    // than once per round. Set this on any channel whose tick() paces itself by
    // WALL CLOCK — i.e. anything built on chargedCast.js — because a once-a-round
    // tick gives such a cast a single animation frame per round and its wind-up
    // reads as a blink (found 2026-09-20). Leave it false for channels whose
    // tick() IS the per-round effect (a drain, a per-round heal): frame-pacing
    // those would fire them sixty times a second. See HeroController.tickInvocation.
    framePaced = false
    target = 'self'
    // Optional minimum stat thresholds — { Magic: 10, INT: 10 } means
    // canActivate fails unless hero.stat('Magic') >= 10 AND hero.stat('INT')
    // >= 10. Used for soft gating; future scroll/unlock abilities
    // compose this field.
    requires = {}

    // Optional hard gate by profile.classType — set to 'caster' on Blink
    // means only profiles with classType === 'caster' can fire it,
    // regardless of stats. Hard category lock; stat-investment can't
    // backdoor in.
    requiresClassType = null

    // Optional gate to a SPECIFIC hero class by profile name, e.g. Hurl Weapon →
    // 'Dwarf'. Finer than requiresClassType (which is a broad category like
    // 'caster'): this locks an ability to one class's signature. null = no lock.
    requiresClass = null

    // Optional gate by the EQUIPPED weapon's `weaponCategory` (MeleeWeapon) —
    // an array of allowed forms, e.g. Bash → ['blunt','fist','natural'] (you
    // can't reliably bash with a blade). canActivate fails if the current
    // weapon's category isn't in the list (or there's no weapon). null = no
    // weapon requirement. Reusable: a future Cleave → ['blade','axe'], etc.
    requiresWeaponCategory = null

    // --- Declarative combat metadata (§3 + §4.4 of
    // documents/v3_ability_progression_system.md). The A->Z pass hoists each
    // ability's hardcoded numbers into these fields so the future
    // leveling/augment system can SCALE damage / INJECT statuses generically
    // instead of editing imperative activate() bodies. All defaults are inert,
    // so an un-converted ability behaves exactly as before.

    // Combat vs non-combat classification (§3). Non-combat abilities (sprint,
    // dig, stealth, …) set `combat = false`. ENFORCEMENT (can't fire while in
    // combat — the ability `context` gate) is a later system; for now this is
    // just the label the A->Z pass assigns to each ability.
    combat = true

    // Power tier — 'ultimate' marks an ability for the Ultimate bar slot (the R
    // slot): typically big effect + high cost + long cooldown, but usable
    // whenever it's off cooldown. The loadout UI restricts the Ultimate slot to
    // tier:'ultimate' abilities. Authoring the ultimates themselves is a later
    // step (after the input system). Default 'normal' = a regular bar ability.
    tier = 'normal'

    // Damage shape for SELF-COMPUTED abilities (the spell-style ones: bolts,
    // novas, beams). Read by rollDamage(): raw = (damageStat ? caster.stat(stat)
    // : 0) + Between(damageMin, damageMax); damageType is resolveDamage's channel.
    //
    // NOTE — two damage models exist, and only this one uses these fields:
    //   1. Self-computed (spells)  -> set these; call rollDamage() + resolveDamage().
    //   2. Weapon-delegated (melee: Bash, Cleave, …) -> they call
    //      dungeon.attackEntity(hero, victim, weapon), so their damage IS the
    //      equipped weapon's (dodge/block/crit/armor/flavor included) and they
    //      only add riders (knockback, stun). Leave these fields at 0; future
    //      leveling scales such abilities via a weapon multiplier, not min/max.
    // Non-damaging abilities (buffs, summons, walls) also leave these at default.
    damageMin = 0
    damageMax = 0
    damageStat = null         // e.g. 'magicPower', 'attackPower'
    // Multiplier on the STAT part of a self-computed roll (scope doc §10.16).
    // The melee kit multiplies hero.attack() (Mighty Blow is 2x); the spell kit
    // only ever ADDED its stat to a small roll, which is why a Rime Lance was
    // five percent of a floor-5 brute. 1 = the old behaviour; the Wizard's
    // damage spells set 1.8 to 3.5. Also what makes a +3 spell-power staff
    // matter: the staff's bonus is multiplied too.
    damageScale = 1
    // The spell's element ('fire' | 'ice' | 'lightning' | 'arcane'), or null for
    // a non-spell. Read by abilities/empower.js: the caster's weapon may empower
    // the spells of one element (a lightning scroll → Arc Lightning) or all of
    // them. Scope doc §10.16.
    element = null
    damageType = 'physical'   // 'physical' | 'magic' — passed to resolveDamage

    // Status inflicted on a surviving victim — a tag template (e.g. the imported
    // `burning`/`slow`) or an array of them. The future "status slots" inject here.
    appliesStatus = null

    // Delivery shape for shape-based abilities (the cone/line/square/ring family
    // delivered by patterns.shapeStrike — see modules/abilities/shapes.js). A
    // spec object the geometry library reads, e.g. { kind: 'cone', length: 3,
    // spread: 1 } or { kind: 'line', length: 5 }. null for abilities whose
    // delivery isn't a tile footprint (chains, self-buffs, walls, single bolts).
    // Rank-up / augments tune an ability by editing THIS data: extend `length`,
    // widen `spread`, or swap `kind` (Acid Spray's line<->cone choice).
    shape = null

    // FX flavor color (hex) — tints the cast pulse, the splash, and the burst so
    // the whole ability reads as one element. null = use the cast preset's
    // default color. Declarative on purpose: a rank trait / variant recolors an
    // ability by mutating THIS field (e.g. an Acid Spray "Toxin" trait swaps the
    // green for purple while also raising toxicity), the same way augments edit
    // `shape` or `damageMin`. The delivery pattern (shapeStrike) reads it.
    fxColor = null

    // --- In-run ability progression (§4 of v3_ability_progression_system.md) ---
    // Instance-scoped, permanent-per-run. Every effect MUTATES the declarative
    // fields above (shape, damageMin/Max, fxColor, ability-specific dot* fields…);
    // rebuild() recomputes them from a lazily-captured pristine base so re-choosing
    // never drifts. Acquisition / fuel / UI / persistence are out of scope — for
    // now the bench (window.training) drives these. Un-authored abilities leave
    // maxLevel = 1 and the maps empty, so the whole system is inert for them.

    level = 1
    maxLevel = 1

    // level N (2..maxLevel) -> mutator(ability). Applied cumulatively for every
    // level from 2 up to the current level — the passive "rank ladder" boost.
    levelBoosts = {}

    // key -> { label, apply(ability) }. Mutually-exclusive build choice; ONE is
    // active per run (chosenAugment). Selectable once level >= augmentLevel.
    augments = {}
    augmentLevel = 1
    chosenAugment = null

    // key -> { label, apply(ability) }. Additive modifiers slotted into trait
    // slots (the Toxin/Caustic/… idea). Up to maxTraits, once level >= traitLevel.
    traits = {}
    traitLevel = 1
    maxTraits = 1
    equippedTraits = []

    constructor(hero) {
        this.hero = hero
        this.cooldownRemaining = 0
    }

    canActivate() {
        if (this.cooldownRemaining > 0) return false
        if (this.hero.actionPoints < (this.cost.ap ?? 0)) return false
        if (this.hero.movementPoints < (this.cost.mp ?? 0)) return false
        // The A->Z training bench (levels/TrainingLevel.js) flips this flag so a
        // single hero can exercise every ability regardless of class/stat GATES.
        // Cooldown + resource costs above still apply for realistic testing.
        const trainingGatesOff = typeof window !== "undefined" && window.TRAINING_GATES_OFF
        if (!trainingGatesOff) {
            if (this.requiresClassType && this.hero.profile?.classType !== this.requiresClassType) {
                return false
            }
            if (this.requiresClass && this.hero.profile?.name !== this.requiresClass) {
                return false
            }
            if (this.requiresWeaponCategory) {
                const category = this.hero.currentWeapon?.()?.weaponCategory
                if (!category || !this.requiresWeaponCategory.includes(category)) return false
            }
            for (const [stat, threshold] of Object.entries(this.requires)) {
                if (this.hero.stat(stat) < threshold) return false
            }
        }
        return true
    }

    activate(hero, target) {
        // Subclasses override.
    }

    // Roll this ability's declarative damage for `caster` (defaults to the
    // owning hero). The SINGLE place level-ups / augments will scale damage, so
    // converted abilities compute their hit from here rather than inlining a
    // Between() roll. Non-damaging abilities (min/max 0, no stat) return 0.
    rollDamage(caster = this.hero) {
        const base = this.damageStat
            ? Math.round(caster.stat(this.damageStat) * (this.damageScale ?? 1))
            : 0
        const spread = (this.damageMin || this.damageMax)
            ? Phaser.Math.Between(this.damageMin, this.damageMax)
            : 0
        // The caster's weapon may add to or multiply the roll (§10.16). A
        // no-op for every weapon that declares no `empower`.
        return empowerDamage(this, caster, base + spread)
    }

    // --- Progression mechanics --------------------------------------------------

    // Lazily snapshot the pristine (level-1, no augment/trait) values of every
    // tunable data field, the FIRST time progression is touched. Must be lazy:
    // subclass field initializers (shape, dot*…) run AFTER the base constructor,
    // so there's nothing to capture at construction time. Captured before any
    // mutation, so the snapshot is always the true base.
    _captureBase() {
        if (this._baseStats) return
        this._baseStats = {}
        for (const key of Object.keys(this)) {
            if (PROGRESSION_INTERNAL.has(key)) continue
            if (typeof this[key] === 'function') continue
            this._baseStats[key] = cloneTunable(this[key])
        }
    }

    // Recompute the tunable fields from the captured base, then layer on level
    // boosts (cumulative), the chosen augment, then equipped traits — in that
    // order. Idempotent: re-choosing an augment or swapping a trait never
    // compounds, because each rebuild starts from the pristine base.
    rebuild() {
        this._captureBase()
        for (const key of Object.keys(this._baseStats)) {
            this[key] = cloneTunable(this._baseStats[key])
        }
        for (let lvl = 2; lvl <= this.level; lvl++) this.levelBoosts[lvl]?.(this)
        if (this.chosenAugment) this.augments[this.chosenAugment]?.apply?.(this)
        for (const key of this.equippedTraits) this.traits[key]?.apply?.(this)
        // Gear-derived empowerments (the throwing style's carried-weapon bonuses)
        // layer LAST, on top of level/augment/traits. Optional hook — abilities
        // that read equipment (throwing skills) define applyEmpowerments(); the
        // base-reset above means dropping the gear removes it on the next rebuild.
        this.applyEmpowerments?.()
        return this
    }

    levelTo(n) {
        this.level = Math.max(1, Math.min(this.maxLevel, Math.trunc(n) || 1))
        return this.rebuild()
    }

    levelUp() { return this.levelTo(this.level + 1) }

    // Pick a mutually-exclusive augment branch (replaces any prior pick). Returns
    // false if the key is unknown or the ability isn't high enough level yet.
    chooseAugment(key) {
        if (!this.augments[key] || this.level < this.augmentLevel) return false
        this.chosenAugment = key
        this.rebuild()
        return true
    }

    // Slot an additive trait. False if unknown, under-level, or slots are full.
    equipTrait(key) {
        if (!this.traits[key] || this.level < this.traitLevel) return false
        if (this.equippedTraits.includes(key)) return true
        if (this.equippedTraits.length >= this.maxTraits) return false
        this.equippedTraits.push(key)
        this.rebuild()
        return true
    }

    unequipTrait(key) {
        const before = this.equippedTraits.length
        this.equippedTraits = this.equippedTraits.filter(k => k !== key)
        if (this.equippedTraits.length !== before) this.rebuild()
        return this
    }

    // Per-round effect for a channeled (invocation) ability — subclasses override.
    // Called by HeroController.tickInvocation each round the channel is active.
    tick(hero, target) {}

    tickCooldown() {
        if (this.cooldownRemaining > 0) this.cooldownRemaining -= 1
    }
}
