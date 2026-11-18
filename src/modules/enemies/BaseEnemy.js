import Phaser from "phaser"
import dungeon from "../Dungeon.js"
import tm from "../TurnManager.js"
import Taggable from "../Taggable.js"
import items, { applyDefaultRandomTags } from "../Items.js"
import { kindOf, isShelled } from "./enemyKinds.js"
import ENEMY_ART from "../../data/enemyArt.js"
import { shouldForceHunter } from "../debugFlags.js"
import GenericItem from "../items/GenericItem.js"
import Container from "../items/Container.js"
import mapState from "../MapState.js"
import run from "../Run.js"
import gameLog from "../GameLog.js"
import { detects, inVisionCone } from "../Perception.js"
import archetypes from "../archetypes/index.js"
import { updateFlee } from "../archetypes/fleeing.js"
import Stats from "../classes/Stats.js"
import { statusesOnEntity } from "../tags/Status.js"
import { syncEntityStatusFX } from "../Animations.js"
// v3 side-effect-imported tags/statusList.js here to register every status's
// metadata for the badge row. v5 does not need it: Taggable imports Tags.js,
// which imports all ten statuses, so the same chain registers them already.

const PERCEPTION_PASSIVE_FILL = 0x666666
const PERCEPTION_PASSIVE_STROKE = 0x888888
const PERCEPTION_ALERTED_FILL = 0xff4444
const PERCEPTION_ALERTED_STROKE = 0xff6666
const PERCEPTION_FILL_ALPHA = 0.06
const PERCEPTION_STROKE_ALPHA = 0.4
const TILE_SIZE = 16

// Cardinal facings used to seed a stationary enemy's vision cone at spawn.
// Movement updates facing toward travel (Dungeon.moveEntityTo).
const FACINGS = [
    { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
]

// Weighted archetype roll. Hunters are omni-perception, always-alerted
// relentless pursuers — kept deliberately rare so most spawns are cone-gated
// and avoidable (a hunter is a "tracker", not a third of every group).
// Archetypes not listed default to weight 1. Tune here.
const ARCHETYPE_ROLL_WEIGHTS = { hunter: 1, patrolling: 3, goingSomewhere: 3 }

function rollArchetype(pool) {
    // Authored "no hunters" (designer Dungeon tab, read live off MapState): drop
    // the hunter archetype from the roll so an authored floor's stances aren't
    // bypassed by always-alerted pursuers. If hunter was the ONLY option, fall
    // back to a plain wanderer rather than emptying the pool.
    if (mapState && mapState.noHunters) {
        const filtered = pool.filter(name => name !== "hunter")
        pool = filtered.length ? filtered : ["goingSomewhere"]
    } else if (shouldForceHunter(pool)) {
        return "hunter"   // test lever: one hunter/floor
    }
    const weights = pool.map(name => ARCHETYPE_ROLL_WEIGHTS[name] ?? 1)
    const total = weights.reduce((sum, w) => sum + w, 0)
    let r = Math.random() * total
    for (let i = 0; i < pool.length; i++) {
        r -= weights[i]
        if (r < 0) return pool[i]
    }
    return pool[pool.length - 1]
}

// Status-badge colors keyed by a status's valence (from the Status
// registry). Green good / red bad / amber situational.
const STATUS_VALENCE_COLOR = {
    positive: 0x4ade80,
    negative: 0xef4444,
    mixed: 0xf59e0b
}

// Enemy slot set per documents/v3_combat_stats_system.md §"Enemy parity":
// smaller than the hero's kit. Three slots total — mainhand, body, accessory.
// equippedStatContribution() walks these and asks each item for its
// per-stat contribution, exactly like HeroInventory.statContribution does.
const ENEMY_SLOT_NAMES = ['mainhand', 'body', 'accessory']

// Dispatch map: enemy kind -> function(enemy) returning {item, log?} or null.
// Adding a new kind's drop table is one entry here plus the method on
// BaseEnemy.
//
// EVERY KIND IN THE v5 ROSTER NOW HAS AN ENTRY (2026-09-22). Before this, kinds
// with no entry dropped nothing at all — which cost Ghost and Slime any reward,
// and made the camp's shopkeeper (scope doc §10.11) unaffordable on a floor that
// happened to spawn them. Now that coins have a SINK, an enemy that drops
// nothing is a floor's income missing rather than a cosmetic gap.
const DROP_TABLES_BY_KIND = {
    humanoid: (enemy) => enemy._rollHumanoidDrop(),
    animal: (enemy) => enemy._rollAnimalDrop(),
    insect: (enemy) => enemy._rollInsectDrop(),
    spirit: (enemy) => enemy._rollSparseDrop("a wisp of ectoplasm"),
    creature: (enemy) => enemy._rollSparseDrop("a spatter of residue"),
}

export default class BaseEnemy extends Taggable {
    constructor(x, y) {
        super()
        this.name = "Basic Enemy"
        this.movementPoints = 1
        this.actionPoints = 1
        this.healthPoints = 1
        this.maxHealthPoints = this.healthPoints
        this.moving = false

        // Initialize the slot map before the `weapon` setter fires below —
        // the setter writes into equippedSlots.mainhand.
        this.equippedSlots = { mainhand: null, body: null, accessory: null }

        // Quest items held aside from equipped gear: payloads that the
        // enemy is carrying (a guarded gem, a stolen key). Mirrors the
        // hero's `quest_items` array. Not run through statContribution
        // — they don't give combat stats; they pour into the death bag
        // when the enemy is killed.
        this.quest_items = []

        // Default mainhand is a virtual stub so subclasses can keep
        // mutating `this.weapon.name = "claws"` without owning anything
        // that should drop on death.
        const stub = new GenericItem()
        stub.virtual = true
        this.weapon = stub

        this.refreshRates = {
            movementPoints: 1,
            actionPoints: 1,
            healthPoints: 0
        }

        // SPD controls how often this enemy gets to act relative to the
        // player (the world metronome). 1 = baseline; >1 = extra turns per
        // player move; <1 = skipped turns. Fractional values accumulate.
        this.speed = 1
        this._speedAccumulator = 0

        // Stats are filled in by applyArchetypeStats() (procgen from the
        // archetype's statTemplate) or applyProfile() (champion enemies
        // using a hero-style profile). Default blank Stats so a
        // mid-construction read doesn't crash.
        this.stats = new Stats()
        this.profile = null

        // Passives carried by this enemy (entity-agnostic — same shape as
        // BaseHero.passives). Empty by default; champions/tamers grant them via
        // grantPassive() (Taggable) or an applyProfile() passives list. This is
        // what lets an ENEMY be a tamer / carry a champion passive.
        this.passives = []

        this.loot = []
        this.x = x
        this.y = y
        this.tile = 26
        // PNG art keyed by class name (see data/enemyArt.js). The render path
        // (Dungeon.initializeEntity) prefers this over the legacy Kenney tile.
        // A subclass or recipe may override this.art before initializeEntity
        // (species captains, gendered / void-corrupted variants).
        this.art = ENEMY_ART[this.constructor.name] ?? null
        this.type = "enemy"
        // Allegiance for the targeting seam (modules/Targeting.js). Enemies are
        // team "monster"; the hero and its followers are "player". Followers
        // override this to "player" (companions/Follower.js).
        this.team = "monster"

        // Depth-curve metadata read from the subclass's static fields
        // (set on each enemy class). Spawn filtering reads the statics
        // directly (no need to instantiate); these instance fields just
        // expose the same values for runtime introspection.
        this.tier = this.constructor.tier ?? 1
        this.rarity = this.constructor.rarity ?? "common"
        this.archetype = this.constructor.archetype ?? null

        // Perception: a short forward cone, not a 360 sphere. detectionRadius
        // is the max sight distance; visionConeDegrees is the FULL cone width
        // (60 => ±30 off facing). Both default low so most species are nearly
        // oblivious until the player is close and in front — archetypes that
        // are meant to be lookouts (patrolling) widen these; hunters bypass
        // perception entirely (always alerted). The dungeon-wide sight/cone
        // scale (mapState.perception*Scale, set from the designer Dungeon tab)
        // tunes these per dungeon at check time via effectiveDetectionRadius /
        // effectiveVisionCone. See documents/v3_combat_infrastructure.md.
        this.detectionRadius = 3
        this.visionConeDegrees = 60
        this.facing = FACINGS[Math.floor(Math.random() * FACINGS.length)]
        this.alerted = false
        this.lastSeenX = null
        this.lastSeenY = null

        // Enemy state machine — Phase 1 step 2 of v3_ai_behavior_system.md.
        // Default is idle; updatePerception drives transitions through
        // alerted -> searching -> idle. Combat states (engaging, fleeing,
        // leaderless) are introduced with archetypes in step 3.
        this.state = "idle"
        this._turnsSinceLastSight = 0

        // Per-fight memory — Phase 2 step 8. Captured on each detection
        // so archetypes (or future SEARCHING bias) can read where the
        // player was heading the last time we saw them.
        this.lastSeenDirection = null
        this.lastInteractionTick = null

        // Order slot — Phase 2 Captain coordination. Captain.issueCommand
        // writes here; archetypes read via _readCurrentOrder so the order
        // only fires from the round after issue and expires on schedule.
        this.currentOrder = null

        // Active Battle this enemy is committed to, or null. Set/cleared by
        // the encounter manager (modules/encounters). isEngaged() reads this,
        // so an enemy only runs its combat AI while it belongs to a live
        // battle — perception/state still tracks alerted for visuals and for
        // the manager's clustering, but it no longer pursues the player on its
        // own. See documents/v3_combat_infrastructure.md.
        this.battle = null

        // Pocket-dimension phasing flag, recomputed each tick by the encounter
        // manager (syncPhasing). True while this enemy is passing through an
        // active arena it doesn't belong to — it's hidden, blind to the fight,
        // and non-blocking. See documents/v3_objective_driven_encounters.md.
        this.phased = false

        // The room this enemy spawned in (set by spawnFromTable for basic
        // enemies; null for squad members and corridor spawns). The encounter
        // manager admits the same-room cohort into an active arena that formed
        // in this room — see EncounterManager.canReinforce.
        this.spawnRoom = null

        // Authored disposition (§16 Stage 2), set by spawnFromTable from the
        // area's `stance`: null (default cone-gated hostile) | "passive" (never
        // initiates, retaliates if hit) | "neutral" (team-neutral truce) |
        // "aggressive" (keener senses) | "territorial" (hostile only in its
        // zone). applyStance() applies spawn-time effects; the perception/turn
        // gates read `stance` live. See documents/v3_dungeon_archetype_system.md §16.3.
        this.stance = null
        this._stanceApplied = null

        // Squad membership. Set by RecipeApplier to the band's captain for
        // both the captain and its members; null for lone/basic enemies. The
        // encounter manager reads this (via isGrouped) to keep squads out of
        // the arena system — they fight free-for-all instead.
        this.squad = null

        // Free-for-all engagement flag, recomputed every tick by the encounter
        // manager (syncPhasing). True for enemies that opt out of arenas
        // (squads, while GROUPS_USE_ARENAS is off): they engage the pre-arena
        // way — whenever alerted — rather than via Battle membership. isEngaged
        // reads it. Default false so a fresh enemy isn't "engaged" before the
        // manager has classified it.
        this.freeForAll = false

        // Morale-break flee state (universal flee, enemy side). Set true by
        // archetypes/fleeing.js when a committed enemy's HP drops below its
        // archetype's fleeThreshold; while true the enemy runs from the fight
        // instead of taking its archetype turn. See
        // documents/v3_objective_driven_encounters.md.
        this.fleeing = false
    }

    refresh() {
        // Summon lifespan: a temporary summon (the `summon` verb sets
        // _summonTurns) counts down each round and fades when it expires, so
        // summons don't snowball. Permanent allies (tamed beasts) leave it unset.
        if (this._summonTurns != null) {
            this._summonTurns -= 1
            if (this._summonTurns <= 0) {
                gameLog.log(`${this.name} fades away.`)
                dungeon.removeEntity(this)
                return
            }
        }

        // Construct orphan-death (encyclopedia §6.5): a CONSTRUCT is a mindless
        // drone with no will of its own — it serves its summoner's purpose, so it
        // has none once the summoner is gone. An orphaned construct (owner dead /
        // removed) crumbles. (Pets persist via the bond stored on the owner; tamed
        // beasts + party allies aren't constructs, so they're unaffected.)
        if (this.bondType === 'construct' && this.owner
            && (!this.owner.sprite || this.owner.healthPoints == null || this.owner.healthPoints <= 0)) {
            gameLog.log(`${this.name} crumbles without its master.`)
            dungeon.removeEntity(this)
            return
        }

        // Accumulate speed across refreshes so fractional speeds skip ticks
        // cleanly (SPD 0.5 acts every other refresh; SPD 1.5 averages 1.5
        // turns per refresh with no rounding drift).
        this._speedAccumulator += this.speed
        const turnsGranted = Math.floor(this._speedAccumulator)
        this._speedAccumulator -= turnsGranted

        this.movementPoints = this.refreshRates.movementPoints * turnsGranted
        this.actionPoints = this.refreshRates.actionPoints * turnsGranted
        if (this.refreshRates.healthPoints > 0 && this.healthPoints <= this.maxHealthPoints) {
            this.healthPoints += this.refreshRates.healthPoints
        }

        if (this._hpBarVisible) {
            this._turnsSinceDamage = (this._turnsSinceDamage || 0) + 1
            if (this._turnsSinceDamage >= 3) {
                this._hideHpBar()
            }
        }
    }

    attack() {
        // Mirrors BaseHero.attack: reads the weapon's attackPowerStat
        // (defaults to 'attackPower'), rolls weapon damage, adds the
        // Magic-derived flavor bonus when the weapon is enchanted and
        // not already a magicPower-scaling weapon.
        // See documents/v3_magic_and_elements.md §"Magic scaling".
        const weapon = this.weapon
        const powerStat = weapon?.attackPowerStat ?? 'attackPower'
        const powerBase = this.stat(powerStat)
        const weaponRoll = weapon?.damage?.() ?? 0
        const flavorBonus = (weapon?.damageFlavor && powerStat !== 'magicPower')
            ? this.stat('magicPower')
            : 0
        return powerBase + weaponRoll + flavorBonus
    }

    protection(damageType = 'physical') {
        if (damageType === 'true') return 0
        if (damageType === 'magic') return this.stat('barrier')

        let base = this.stat('armor')
        // Captain's defend order grants a small protection bonus while
        // the order is active. Check currentOrder directly (not via
        // _readCurrentOrder) so we don't side-effect-clear the order
        // during a combat call.
        const o = this.currentOrder
        if (o && o.command === "defend"
            && tm.tickCount >= o.availableAt
            && (o.expireAt == null || tm.tickCount < o.expireAt)) {
            base += 2
        }
        return base
    }

    // One-stop "you just constructed this enemy, finish setup": roll
    // archetype from the class's archetypePool if no fixed archetype is
    // set, then apply archetype-driven stats (skipped if a profile was
    // already attached for a champion). Idempotent — safe to call from
    // multiple spawn paths (getRandomEnemy, RecipeApplier, summoner tag).
    finalizeSpawn() {
        if (this._spawnFinalized) return this
        this._spawnFinalized = true
        if (!this.archetype && this.constructor.archetypePool) {
            this.archetype = rollArchetype(this.constructor.archetypePool)
        }
        if (!this.profile) {
            this.applyArchetypeStats()
        }
        return this
    }

    // Roll stats from the active archetype's statTemplate, then derive
    // maxHP via the archetype's hpFormula. Champion enemies (carrying a
    // hero profile) skip this — they get deterministic stats via
    // applyProfile.
    applyArchetypeStats() {
        const arche = archetypes[this.archetype]
        if (!arche || !arche.statTemplate) return

        const rolled = {}
        for (const [name, range] of Object.entries(arche.statTemplate)) {
            const [low, high] = range
            rolled[name] = Phaser.Math.Between(low, high)
        }
        this.stats = Stats.from(rolled)

        if (arche.hpFormula) {
            this.maxHealthPoints = arche.hpFormula(this.stats)
            this.healthPoints = this.maxHealthPoints
        }

        // Archetype perception override — lookouts (patrolling) see farther and
        // wider; most archetypes omit this and keep the BaseEnemy defaults.
        if (arche.perception) {
            if (arche.perception.radius != null) this.detectionRadius = arche.perception.radius
            if (arche.perception.coneDegrees != null) this.visionConeDegrees = arche.perception.coneDegrees
        }
    }

    // Apply a hero-style profile to this enemy — for "champion" variants
    // that should carry a specific stat sheet (e.g., a Warrior champion).
    // Profile shape matches BaseHero.applyProfile, but only stats and
    // hpFormula are honored: identity (name/tile) stays the species,
    // startingItems/tags can still be attached separately at spawn time.
    applyProfile(profile) {
        if (!profile) return this
        this.profile = profile
        this.stats = Stats.from(profile.stats)
        if (profile.hpFormula) {
            this.maxHealthPoints = profile.hpFormula(this.stats)
            this.healthPoints = this.maxHealthPoints
        }
        return this
    }

    // Mainhand slot exposed under the legacy `weapon` name so the
    // 44+ enemy subclasses doing `this.weapon.name = "claws"` and the
    // archer/caster tags doing `this.weapon = makeItem('bow')` continue
    // to work without edits. Combat archetypes read `enemy.weapon` and
    // get the current mainhand item.
    get weapon() {
        return this.equippedSlots.mainhand
    }
    set weapon(item) {
        this.equippedSlots.mainhand = item
    }

    // Sum the named stat across all equipped slots, mirroring
    // HeroInventory.statContribution. Each item's statContribution
    // decides how it contributes to a given stat.
    equippedStatContribution(name) {
        let total = 0
        for (const slot of ENEMY_SLOT_NAMES) {
            const item = this.equippedSlots[slot]
            if (!item) continue
            total += item.statContribution?.(name) ?? 0
        }
        return total
    }

    // Shim for Taggable to wrap, mirroring BaseHero. Status tags with a
    // statContribution(running, name) handler accumulate their bonus through
    // here, so buffs/debuffs (Emboldened, and any future Might/Bless on a
    // champion) actually move an enemy's stats. Returns 0 untouched when no
    // such tag is present.
    statContribution(name) { return 0 }

    // Combat event shims for Taggable to wrap, mirroring BaseHero — a passive tag
    // adds an onKill/onDodge/onDamaged handler that Combat.attack fires (kill /
    // successful dodge / surviving a hit). Lets champion enemies carry the same
    // triggered passives. No-op base so the wrap always has something to chain.
    onKill(victim) {}
    onDodge(attacker) {}
    onDamaged(attacker, dealt) {
        // A NEUTRAL that takes damage abandons neutrality and fights back — the truce
        // is broken. This path catches INDIRECT damage (hazards, DoTs, an AoE that
        // splashes a neutral); a direct strike also provokes via dungeon.attackEntity
        // before the hit lands (so even a 0-damage swing breaks the truce).
        // provokeFromNeutral is idempotent, so the two paths never double-fire.
        if (this.team === "neutral" && attacker && attacker.team && attacker.team !== "neutral") {
            this.provokeFromNeutral(attacker)
        }
        // A PASSIVE enemy that's attacked abandons passivity and fights back —
        // it becomes aggressive and alerts, so the perception gate stops
        // suppressing it (§16.3 "only turns hostile if attacked").
        if (this.stance === "passive" && attacker && attacker.team && attacker.team !== this.team) {
            this.stance = "aggressive"
            this.applyStance()
            this.alerted = true
        }
    }
    // Attacker-side counterpart (mirrors BaseHero): fires on the ATTACKER each time
    // it deals damage, so champion enemies can carry on-hit procs (Devour). No-op base.
    onDealtDamage(victim, dealt) {}

    // Flip a NEUTRAL onto the hostile side and cancel any bargain it was offering —
    // the general "attack a neutral and it turns on you" rule (neutrality is a truce,
    // not immunity). Its combat AI engages next turn (CosmicBeing.turn stops idling
    // once team != "neutral"); a struck pact/boon offerer also withdraws its offer so
    // it can't be re-heard. Idempotent — a no-op once already hostile.
    provokeFromNeutral(provoker) {
        if (this.team !== "neutral") return
        this.team = "monster"
        this.type = "enemy"
        this.alerted = true
        // Drop the pacifist stance gate so updatePerception can keep it alerted
        // (an authored neutral would otherwise be re-suppressed to alerted=false
        // on the next tick and stop fighting the moment it was provoked).
        if (this.stance === "neutral" || this.stance === "passive") {
            this.stance = "aggressive"
            this._stanceApplied = "aggressive"   // team already flipped; don't re-run applyStance
        }
        this.pactPending = false
        this.pactOfferer = false
        this.boonOfferer = false
        gameLog.log(`${this.name} turns on ${provoker?.name || "you"} — the truce is broken!`)
    }

    // Outgoing-accuracy shim for Taggable to wrap (mirrors BaseHero). Combat.attack
    // calls this on the attacker before the victim's dodge; Blind wraps it to make
    // the swing whiff. Base returns true = lands normally.
    attackHits() { return true }

    // Incoming-damage multiplier shim (mirrors BaseHero). resolveDamage and
    // Combat.attack multiply final damage by this on the victim; Marked wraps it to
    // amplify damage taken. Base 1 = no change.
    damageTakenMult() { return 1 }

    // Outgoing-damage multiplier shim (mirrors BaseHero) — passed the victim so a
    // passive (Opportunist) can scale damage by the target's state. Base 1.
    outgoingDamageMult(victim) { return 1 }

    // Incoming-heal multiplier shim (mirrors BaseHero). universals.heal() scales the
    // heal amount by this on the recipient; Unmaking wraps it to deny restoration. Base 1.
    incomingHealMult() { return 1 }

    // Armor/barrier penetration shim (mirrors BaseHero) — the attacker subtracts this
    // from the victim's protection for `damageType`. Spell Pierce wraps it. Base 0.
    armorPen(damageType) { return 0 }

    // Stat reducer for enemies. Mirrors BaseHero.stat: base value from
    // the entity's stats + per-stat contributions from equipped items +
    // status-tag contributions (via the wrapped shim above).
    // Virtual built-in equipment flows through here too — a primitive
    // Skeleton's stub claws can contribute without ever appearing as
    // real loot.
    stat(name) {
        return this._statBase(name)
            + this.equippedStatContribution(name)
            + this.statContribution(name)
    }

    _statBase(name) {
        const S = this.stats
        switch (name) {
            case 'STR': return S.STR
            case 'DEX': return S.DEX
            case 'CON': return S.CON
            case 'SPD': return S.SPD
            case 'INT': return S.INT
            case 'Magic': return S.Magic
            case 'attackPower': return S.STR
            case 'rangedAttackPower': return S.DEX + Math.floor(S.STR / 2)
            case 'magicPower': return S.Magic
            case 'block': return Math.floor((S.STR + S.CON) / 4)
            case 'dodge': return Math.floor((S.DEX + S.SPD) / 4)
            case 'barrier': return Math.floor(S.Magic / 2)
            // Most archetypes have no native armor — only champions (via
            // a profile.classArmorBase) get a non-zero base.
            case 'armor': return this.profile?.classArmorBase
                ? this.profile.classArmorBase(this.stats)
                : 0
            case 'critChance': return 0.05
            case 'critMultiplier': return 2
            default: return 0
        }
    }

    dodgeChance() {
        return Math.min(0.5, this.stat('dodge') * 0.03)
    }

    blockChance() {
        // Animals and insects don't have the anatomy to deflect weapon
        // blows — a bat doesn't block a mace. Exception: shelled
        // species (Beetle, Crab, Scarab, Scorpion per isShelled) have
        // natural armor that absorbs blows. Dodge stays available for
        // every kind.
        const kind = kindOf(this)
        if ((kind === 'animal' || kind === 'insect') && !isShelled(this)) return 0
        return Math.min(0.5, this.stat('block') * 0.03)
    }

    turn() {
        // Stun skips the archetype call AND zeros AP/MP so over() returns
        // true after this call — TurnManager keeps calling turn() until
        // the entity is over, so without the zero a stunned enemy would
        // tick its stun handler multiple times per round.
        if (this._tags && this._tags.includes("Stun")) {
            this.movementPoints = 0
            this.actionPoints = 0
            return
        }

        // Daze — like Stun, skips the archetype and zeros AP/MP, but it's a lighter
        // 1-turn stagger (secondary slam / shockwave targets). The daze tag's own
        // turn() handler counts it down; this zero makes over() return true so the
        // round can complete without re-ticking.
        if (this._tags && this._tags.includes("Daze")) {
            this.movementPoints = 0
            this.actionPoints = 0
            return
        }

        // Rooted zeros movementPoints but leaves actionPoints alone —
        // the enemy can still attack from its current tile if anyone
        // is in range. The archetype runs normally; its own AP-decrement
        // at the end of turn ensures the round can complete.
        if (this._tags && this._tags.includes("Rooted")) {
            this.movementPoints = 0
        }

        // Universal flee (enemy side): a committed enemy whose morale breaks
        // leaves the fight and runs for open space, skipping its archetype
        // turn until it's clear. See documents/v3_objective_driven_encounters.md.
        if (updateFlee(this)) return

        // Dispatch to the archetype's turn function. Archetypes are now
        // objects (turn, statTemplate, hpFormula); the hunter / patrolling
        // / goingSomewhere AI that used to live on tags moved here too.
        const arche = archetypes[this.archetype]
        if (arche && typeof arche.turn === "function") {
            arche.turn(this)
        } else if (!this._archetypeWarned) {
            // An unresolved archetype is not a harmless no-op: this enemy will
            // never spend its points, so tm.over() never goes true, the round
            // never refreshes, and the PLAYER silently loses the ability to move.
            // v3 could afford to swallow it (ten archetypes registered, spawns
            // driven by recipes); v5 registers five, so a pool naming anything
            // else deadlocks the game with nothing in the console. Warn once per
            // entity rather than every frame.
            this._archetypeWarned = true
            console.warn(
                `[BaseEnemy] ${this.name} has no usable archetype (got "${this.archetype}"). ` +
                `It will never take a turn, which stalls the round. ` +
                `Registered: ${Object.keys(archetypes).join(", ")}. ` +
                `Was finalizeSpawn() called on it?`
            )
        }
    }

    blockAttack(attacker) {
        return false
    }

    over() {
        let isOver = this.movementPoints == 0 && this.actionPoints == 0 && !this.moving

        if (this.UItext) {
            this.UItext.setColor(isOver ? "#cfc6b8" : "#fff")
        }

        return isOver
    }

    // Perception values after the dungeon-wide scale (Dungeon tab). Read live
    // from mapState so tag/archetype/subclass overrides (e.g. farsight, captain)
    // and the debug overlay all reflect the same effective sight. Defaults to 1x.
    //
    // The AMBIENT scale is the day/night cycle (FogOfWar publishes it each hero
    // move; 1 on any floor with no sky). It multiplies rather than replaces the
    // designer's knob, so the two stay independent: night dims enemy sight on an
    // outdoor floor without overriding what the author asked for. This is what
    // makes darkness a stealth window instead of a one-sided penalty on the hero.
    get effectiveDetectionRadius() {
        const s = ((mapState && mapState.perceptionRangeScale) || 1)
            * ((mapState && mapState.ambientPerceptionScale) || 1)
        return Math.max(0, Math.round(this.detectionRadius * s))
    }
    get effectiveVisionCone() {
        const s = (mapState && mapState.perceptionConeScale) || 1
        return Math.min(180, this.visionConeDegrees * s)
    }

    // Apply a stance's spawn-time effects (§16 Stage 2). Idempotent per stance
    // value (safe to re-call, e.g. when a passive flips aggressive on being hit).
    // The gates that need per-tick logic (passive/neutral don't alert on sight;
    // territorial alerts only in-zone) live in updatePerception; the return-home
    // handler lives in archetypes/territorial.js.
    applyStance() {
        if (this._stanceApplied === this.stance) return
        this._stanceApplied = this.stance
        if (this.stance === "neutral") {
            // A true truce both ways — reuse the existing neutral team so
            // isHostile/provokeFromNeutral work verbatim.
            this.team = "neutral"
        } else if (this.stance === "aggressive") {
            // Keener senses: notices the hero from farther and through a wider
            // arc. (Not pre-alerted from spawn — that would recreate the
            // across-the-floor rush; the pre-alerted room-guardian emerges as
            // aggressive + roam=zone in Stage 3.)
            this.detectionRadius = Math.round(this.detectionRadius * 1.5)
            this.visionConeDegrees = Math.min(180, this.visionConeDegrees * 1.5)
        }
        // passive / territorial need no spawn-time change; their zone is the
        // spawnRoom bound by spawnFromTable.
    }

    // Is the hero inside this enemy's home zone (territorial gating)? The zone is
    // its spawnRoom (or homeRoom). No zone bound → treat as always in-zone so a
    // territorial enemy without a room behaves like a normal hostile.
    _heroInHomeZone(target) {
        const z = this.homeRoom || this.spawnRoom
        if (!z) return true
        return target.x >= z.x && target.x < z.x + z.w
            && target.y >= z.y && target.y < z.y + z.h
    }

    updatePerception(target) {
        const wasAlerted = this.alerted

        // v3 short-circuited perception here for an enemy committed to a Battle:
        // inside an arena it cannot "lose" the player. v5 has no encounter manager,
        // so that gate is permanently false and the cone+radius detection below
        // always runs — which is what lets an enemy lose track of you again, and
        // what makes Stealth mean something.

        // Phased out: passing through an active arena this enemy isn't part of.
        // It can't perceive the fight at all — drop any alert and skip detection
        // so it never notices or chases the hero from inside the pocket. It
        // still takes its turn (moving through, invisibly); it just acts as if
        // the hero weren't there. Restores to normal perception the tick it
        // leaves the ring (phased is recomputed each tick).
        if (this.phased) {
            this.alerted = false
            return
        }

        // Post-battle grace: for a brief window after a fight resolves the hero
        // is "unnoticeable" — enemies that were outside the arena don't snap to
        // alert the instant the pocket dissolves, so the player gets a moment to
        // break away instead of being re-detected on the same tile. Set by the
        // EncounterManager when combat ends; clears itself when the tick passes.
        if (target.unnoticeableUntil && tm.tickCount < target.unnoticeableUntil) {
            this.alerted = false
            return
        }

        // Stance gate (§16 Stage 2): shape whether sight can raise the alarm.
        // passive/neutral never initiate on sight (only retaliate if attacked);
        // territorial alarms only while the hero is inside its home zone;
        // aggressive + default use normal cone+radius detection (aggressive just
        // spawned with wider values).
        let sighted = detects(this, target, this.effectiveDetectionRadius)
            && inVisionCone(this, target, this.effectiveVisionCone)
        if (this.stance === "passive" || this.stance === "neutral") {
            sighted = false
        } else if (this.stance === "territorial") {
            sighted = sighted && this._heroInHomeZone(target)
        }
        this.alerted = sighted
        // Stealth/Underground clears more than the alert flag: cached
        // destination (set while alerted) would otherwise have non-
        // alerted archetypes walk straight to the player's last-known
        // tile. Drop the destination AND skip the searching state so
        // alerted enemies go straight to idle when the target vanishes.
        const targetStealthed = target?._tags?.includes("Invisible")
            || target?._tags?.includes("Underground")
        if (this.alerted) {
            // Per-fight memory: capture which way the target was heading
            // since we last saw them. Used by SEARCHING bias in future
            // polish; written here so the field is current at the moment
            // we lose sight.
            if (this.lastSeenX != null && this.lastSeenY != null) {
                const ddx = target.x - this.lastSeenX
                const ddy = target.y - this.lastSeenY
                if (ddx !== 0 || ddy !== 0) {
                    this.lastSeenDirection = { dx: Math.sign(ddx), dy: Math.sign(ddy) }
                }
            }
            this.lastSeenX = target.x
            this.lastSeenY = target.y
            this.lastInteractionTick = tm.tickCount
            this._turnsSinceLastSight = 0
        }
        if (this.alerted && !wasAlerted) {
            this._flashAlert()
            gameLog.log(`The ${this.name} notices you.`)
        }
        if (!this.alerted && wasAlerted) {
            gameLog.log(`The ${this.name} is confused as you vanish.`)
            this._flashLost()
        }

        // Drive the state machine off the same perception ping.
        // Detect ping pulls IDLE/PATROLLING/SEARCHING up to ALERTED;
        // losing sight while alerted drops to SEARCHING; sustained
        // no-contact while searching decays back to IDLE.
        if (this.alerted) {
            if (this.state === "idle" || this.state === "patrolling" || this.state === "searching") {
                this.transitionState("alerted")
            }
        } else if (wasAlerted && this.state === "alerted") {
            if (targetStealthed) {
                // Target vanished into stealth — clear destination and
                // skip the searching grace period entirely (per the
                // design's "alert enemies forget after 1 idle turn").
                this._destinationX = null
                this._destinationY = null
                this.transitionState("idle")
            } else {
                this.transitionState("searching")
            }
        } else if (this.state === "searching") {
            this._turnsSinceLastSight += 1
            if (this._turnsSinceLastSight > 5) {
                this.transitionState("idle")
                this._turnsSinceLastSight = 0
            }
        }
    }

    transitionState(newState) {
        if (newState === this.state) return
        const prev = this.state
        this.state = newState

        // Alert propagation (Phase 1 step 4). When this enemy becomes
        // alerted from a non-combat state, shout "player at lastSeen"
        // to nearby idle/patrolling allies. Recipients enter alerted
        // themselves and re-fire the broadcast, chaining the alert
        // through a connected squad in a single tick.
        if (newState === "alerted" && prev !== "engaging" && prev !== "alerted") {
            this._broadcastAlert()
        }
    }

    _broadcastAlert() {
        const ALERT_RADIUS = 8
        for (const other of tm.entities) {
            if (other === this) continue
            if (other.type !== "enemy") continue
            if (other.state !== "idle" && other.state !== "patrolling") continue
            // Passive/neutral enemies aren't roused by an ally's alarm — they only
            // fight if personally provoked (§16.3), so a squad shout never drags
            // them (or their calm perception cone) into the fight.
            if (other.stance === "passive" || other.stance === "neutral") continue
            const dx = other.x - this.x
            const dy = other.y - this.y
            const distance = Math.max(Math.abs(dx), Math.abs(dy))
            if (distance > ALERT_RADIUS) continue

            if (this.lastSeenX != null && this.lastSeenY != null) {
                other.lastSeenX = this.lastSeenX
                other.lastSeenY = this.lastSeenY
            }
            other.transitionState("alerted")
        }
    }

    isEngaged() {
        // "Engaged" now means committed to a live Battle, not merely alerted.
        // The encounter manager promotes nearby alerted enemies into a battle;
        // until then an alerted-but-uncommitted enemy falls through to its
        // archetype's idle path instead of free-for-all pursuing the player.
        // This is the single gate that stops the whole floor swarming. The 4
        // combat archetypes, the TurnManager throttle, blitz's ally count, and
        // the summoner tag all read through here, so they stay consistent.
        // v5: BOTH halves of v3's test are permanently false. `battle` is set only
        // by the encounter manager and `freeForAll` only by its syncPhasing — both
        // cut — so isEngaged() always returned false, no enemy ever ran its combat
        // AI, and they only ever swung at you if you happened to stand adjacent.
        //
        // v5 restores the pre-arena rule the comment above describes as the
        // fallback: engaged means alerted. There is no arena to be admitted to, so
        // there is nothing for the gate to wait for. The gate's original job —
        // stopping the whole floor swarming at once — now falls to perception:
        // an enemy pursues only while it has actually noticed you, and the cone +
        // radius detection can still lose you.
        if (this.alerted === true) return true
        if (this.battle != null && this.battle.active) return true
        // Free-for-all fallback: enemies the encounter manager opts out of the
        // arena system (squads, while GROUPS_USE_ARENAS is off) never get a
        // Battle, so they'd never read as engaged. Restore the pre-arena rule
        // for them — engaged whenever alerted — so captains still command and
        // members still pursue. The flag is set each tick in syncPhasing.
        return this.freeForAll === true && this.alerted === true
    }

    _readCurrentOrder() {
        const order = this.currentOrder
        if (!order) return null
        // Orders are visible only from the round after issue. The Captain
        // and the ally may iterate in either order within tm.turn(); this
        // guarantee makes the "execute on their next turn" beat reliable.
        if (tm.tickCount < order.availableAt) return null
        // One-shot orders carry an explicit expireAt. Clear and drop.
        if (order.expireAt != null && tm.tickCount >= order.expireAt) {
            this.currentOrder = null
            return null
        }
        return order
    }

    consumeOrder() {
        if (this.currentOrder && !this.currentOrder.persistent) {
            this.currentOrder = null
        }
    }

    _flashAlert() {
        if (!this.sprite) return
        const scene = this.sprite.scene
        const restore = this.tint
        this.sprite.setTint(0xffaa00)
        scene.time.delayedCall(180, () => {
            if (!this.sprite) return
            if (restore) this.sprite.setTint(restore)
            else this.sprite.clearTint()
        })
    }

    _flashLost() {
        if (!this.sprite) return
        const scene = this.sprite.scene
        const restore = this.tint
        this.sprite.setTint(0x6688aa)
        scene.time.delayedCall(180, () => {
            if (!this.sprite) return
            if (restore) this.sprite.setTint(restore)
            else this.sprite.clearTint()
        })
    }

    // Destroy the auxiliary world visuals (HP bar, perception wedge, order dot,
    // status badges/FX) and release any sealed doors. Split out of onDestroy so
    // allies (companions/Follower.js) can reuse the teardown without the
    // enemy-only drop-table / kill-tally that follows it.
    _teardownVisuals() {
        if (this.worldHpBg) this.worldHpBg.destroy()
        if (this.worldHpFill) this.worldHpFill.destroy()
        if (this.perceptionCircle) this.perceptionCircle.destroy()
        if (this.orderIndicator) this.orderIndicator.destroy()
        if (this.statusBadges) this.statusBadges.forEach(b => b.destroy())
        if (this.statusFX) Object.values(this.statusFX).forEach(fx => fx.destroy())

        // Duelist-gate elite: release any doors this enemy was sealing.
        if (this._sealedDoors) {
            for (const door of this._sealedDoors) {
                if (door.unseal) door.unseal()
            }
            this._sealedDoors = null
        }
    }

    onDestroy() {
        // Player-team entities (summoned Followers, tamed beasts) are allies:
        // no loot, no kill tally — they just leave the leader's party and tear
        // down. Generalized here so both companions/Follower and any tamed enemy
        // (convertToAlly) get a clean ally death.
        if (this.team === 'player') {
            gameLog.log(`${this.name} falls.`)
            if (this.leader && Array.isArray(this.leader.party)) {
                const i = this.leader.party.indexOf(this)
                if (i >= 0) this.leader.party.splice(i, 1)
            }
            this._teardownVisuals()
            return
        }

        gameLog.log(`${this.name} was killed.`)

        this._teardownVisuals()

        if (run.stats) {
            run.stats.kills += 1
            // Run-score skill-point trickle (§14 B7). Arena/training mobs (noDrops)
            // don't feed the run economy.
            if (!this.noDrops) run.rewardKill()
        }

        // Training-arena mobs leave no loot (set by the spawn helper).
        if (this.noDrops) return

        const x = this.x
        const y = this.y

        // Collect everything this corpse pours out. Quest items always
        // drop (held payloads — guarded gems, stolen keys); humanoids
        // additionally roll a weighted drop table; non-humanoid beasts
        // drop nothing else (the broader loot-tables design is deferred
        // — see documents/v3_combat_design_planning.md).
        const drops = []
        drops.push(...this.quest_items)

        // Dispatch to the kind-specific drop table. Each table returns
        // either null (no drop) or `{ items: [...], log? }` — the optional
        // log replaces the generic "drops a loot bag" message so flavor
        // text reads naturally for non-humanoid kills ("drops a tuft
        // of fur"). Kinds with no entry in the map (spirit, creature,
        // slime) drop nothing beyond quest items. Tables can return
        // multiple items at once (humanoid's independent gem roll +
        // main drop are the first user of this).
        let dropLog = null
        const dropTable = DROP_TABLES_BY_KIND[kindOf(this)]
        if (dropTable) {
            const result = dropTable(this)
            if (result && result.items) {
                drops.push(...result.items)
                if (result.log) dropLog = result.log
            }
        }

        if (drops.length === 0) return

        const existing = mapState.containerAtTile(x, y)
        if (existing) {
            existing.contents.push(...drops)
        } else {
            tm.addEntity(new Container(x, y, "bag", drops))
        }
        gameLog.log(dropLog ?? `${this.name} drops a loot bag.`)
    }

    // Humanoid drop = two independent rolls (so gems don't crowd out
    // the other categories):
    //
    // 1. Independent gem roll — 50% chance, separate from the main table.
    //    Restores the old gem rate without making gems compete with
    //    potions/gear for the slot. Items constructed without x/y so
    //    they have no sprite — they live inside the bag's contents.
    //
    // 2. Main weighted roll (sums to 100%):
    //      40% Potion     — random of HealthPotion/Greater/Stamina/Cure
    //                       (weighted toward healing — see _rollHumanoidPotion)
    //      10% DungeonKey — rare
    //      35% Item       — plain (untagged) gear piece; bread-and-butter
    //      15% mainhand   — drop the equipped weapon, if it's a real
    //                       (non-virtual) item. Falls back to a plain
    //                       Item when the enemy only has built-in claws.
    //
    // Untagged-gear path is intentional per the user's design: plain
    // items make the equipped-weapon drop read as the comparatively
    // interesting reward.
    _rollHumanoidDrop() {
        const out = []

        if (Math.random() < 0.50) {
            out.push(applyDefaultRandomTags(new items.Gem()))
        }

        const roll = Math.random()
        if (roll < 0.40) {
            out.push(applyDefaultRandomTags(this._rollHumanoidPotion()))
        } else if (roll < 0.50) {
            out.push(applyDefaultRandomTags(new items.DungeonKey()))
        } else if (roll < 0.85) {
            out.push(this._rollHumanoidGear())
        } else {
            const mainhand = this.equippedSlots.mainhand
            // `droppable: false` opts a weapon out of this branch — for a conduit
            // that belongs to the caster rather than to the loot table (the Dark
            // Sorcerer's Dark Bolt). Without it the player is handed a caster
            // weapon no v5 class is built to use.
            //
            // Read off `.profile`, not the instance: the weapon classes copy only
            // a named subset of profile fields onto `this`, and droppable is not
            // among them. The instance keeps its profile, which is how damage()
            // and range() read their own numbers.
            const undroppable = mainhand
                && (mainhand.droppable === false || mainhand.profile?.droppable === false)
            if (mainhand && !mainhand.virtual && !undroppable) {
                this.equippedSlots.mainhand = null
                out.push(mainhand)
            } else {
                out.push(this._rollHumanoidGear())
            }
        }

        return { items: out }
    }

    // Weighted potion pick — healing dominates so kills reliably top
    // up HP. Stamina and Cure are utility drops that show up but don't
    // crowd out the healing path.
    //   55% HealthPotion         — basic healing, bread-and-butter
    //   20% GreaterHealthPotion  — stronger healing, less common
    //   13% StaminaPotion        — utility
    //   12% Potion (Cure)        — utility (cursed-item cleanse)
    _rollHumanoidPotion() {
        const roll = Math.random()
        if (roll < 0.55) return new items.HealthPotion()
        if (roll < 0.75) return new items.GreaterHealthPotion()
        if (roll < 0.88) return new items.StaminaPotion()
        return new items.Potion()
    }

    _rollHumanoidGear() {
        // Each entry is a factory wrapper exposed by Items.js — calling
        // `new gearFactory()` returns a fresh MeleeWeapon/RangedWeapon/
        // Armor built from the corresponding profile.
        const GEAR_FACTORIES = [
            items.Sword,
            items.Axe,
            items.LongSword,
            items.Mace,
            items.Spear,
            items.Bow,
            items.Shield,
            items.Helmet,
        ]
        const gearFactory = Phaser.Utils.Array.GetRandom(GEAR_FACTORIES)
        return new gearFactory()
    }

    // Placeholder animal drop — drops a gem (or rare key) plus a flavor
    // log line about the body part that *should* be dropping here once
    // the food/cooking system exists. See v3_known_issues.md #57.
    //   90% Gem
    //   10% DungeonKey
    // Real implementation: a Food / IngredientClass family with weights
    // appropriate to the species (wolf -> meat + pelt, bear -> meat +
    // hide + claw, etc.).
    _rollAnimalDrop() {
        const ANIMAL_PARTS = [
            "tuft of fur",
            "scrap of hide",
            "piece of meat",
            "chunk of bone",
            "broken claw",
            "shred of pelt",
        ]
        const part = Phaser.Utils.Array.GetRandom(ANIMAL_PARTS)
        const item = Math.random() < 0.90
            ? applyDefaultRandomTags(new items.Gem())
            : applyDefaultRandomTags(new items.DungeonKey())
        return { items: [item], log: `${this.name} drops a ${part}.` }
    }

    // Ghosts and slimes: things that carry no gear and have no pockets. A
    // coin-only drop at a lower rate than the animal table's 90%, so they are
    // worth killing without being as profitable as something that could
    // plausibly be looted. No keys and no gear — an incorporeal spirit handing
    // over a helmet reads wrong, which is why this is its own table rather than
    // a third caller of the animal one.
    _rollSparseDrop(flavor) {
        if (Math.random() > 0.55) return null
        return {
            items: [applyDefaultRandomTags(new items.Gem())],
            log: `${this.name} leaves ${flavor}.`,
        }
    }

    // Placeholder insect drop — same structure as animal, different
    // flavor pool. See v3_known_issues.md #57.
    // Real implementation: a Crafting / MaterialClass family for
    // alchemy / smithing ingredients (chitin, venom, web silk, etc.).
    _rollInsectDrop() {
        const INSECT_PARTS = [
            "chitin shard",
            "leg fragment",
            "wing scrap",
            "antenna piece",
            "broken mandible",
            "sliver of carapace",
        ]
        const part = Phaser.Utils.Array.GetRandom(INSECT_PARTS)
        const item = Math.random() < 0.90
            ? applyDefaultRandomTags(new items.Gem())
            : applyDefaultRandomTags(new items.DungeonKey())
        return { items: [item], log: `${this.name} drops a ${part}.` }
    }

    onSpriteCreated() {
        const scene = this.sprite.scene
        const barWidth = 14
        const barHeight = 2
        this._hpBarOffsetX = (16 - barWidth) / 2
        this._hpBarOffsetY = -4
        this._hpBarWidth = barWidth

        this.worldHpBg = scene.add.rectangle(
            this.sprite.x + this._hpBarOffsetX,
            this.sprite.y + this._hpBarOffsetY,
            barWidth, barHeight, 0x2a2a2a
        ).setOrigin(0).setDepth(50).setAlpha(0)

        this.worldHpFill = scene.add.rectangle(
            this.sprite.x + this._hpBarOffsetX,
            this.sprite.y + this._hpBarOffsetY,
            barWidth, barHeight, 0xef4444
        ).setOrigin(0).setDepth(51).setAlpha(0)

        this._lastKnownHp = this.healthPoints
        this._hpBarVisible = false
        this._turnsSinceDamage = 0

        // Vision overlay (debug, toggled by the perception-zones preference).
        // A Graphics object redrawn each frame in syncPerceptionCircle: a wedge
        // matching the facing cone for normal enemies, or a full circle for
        // omni perceivers (hunters / no facing). Redraw is needed because
        // facing moves as the enemy walks.
        this.perceptionCircle = scene.add.graphics().setDepth(5)

        // Order indicator — small blue dot above the HP bar, only visible
        // while currentOrder is active. Tells the player at a glance
        // which enemies are currently following a Captain's command.
        this._orderIndicatorOffsetX = 12
        this._orderIndicatorOffsetY = -3
        this.orderIndicator = scene.add.circle(
            this.sprite.x + this._orderIndicatorOffsetX,
            this.sprite.y + this._orderIndicatorOffsetY,
            2,
            0x60a5fa
        ).setDepth(52).setVisible(false)

        // Status badges — a row of small valence-colored squares just above
        // the HP bar, one per active status. Exact identity stays on the
        // hover tooltip; this row is the at-a-glance "what's on this enemy"
        // cue. Built lazily in syncStatusBadges to match the live count.
        this._statusBadgeOffsetY = -8
        this.statusBadges = []

        // Status FX overlays, keyed by fx descriptor (e.g. "burning"). Built
        // lazily in syncStatusFX, one looping overlay per active status that
        // declares an `fx`. Torn down when the status clears or the enemy dies.
        this.statusFX = {}
    }

    syncPerceptionCircle(visible) {
        // Allies (player team) don't use the enemy vision cone — suppress it so a
        // tamed beast / Follower doesn't draw a meaningless wedge.
        if (this.team === 'player') {
            if (this.perceptionCircle) this.perceptionCircle.clear()
            return
        }
        const g = this.perceptionCircle
        if (!this.sprite || !g) return

        g.clear()
        if (!visible) return

        const cx = this.sprite.x + TILE_SIZE / 2
        const cy = this.sprite.y + TILE_SIZE / 2
        const r = this.effectiveDetectionRadius * TILE_SIZE
        const fill = this.alerted ? PERCEPTION_ALERTED_FILL : PERCEPTION_PASSIVE_FILL
        const stroke = this.alerted ? PERCEPTION_ALERTED_STROKE : PERCEPTION_PASSIVE_STROKE

        g.fillStyle(fill, PERCEPTION_FILL_ALPHA)
        g.lineStyle(1, stroke, PERCEPTION_STROKE_ALPHA)

        // Omni perceivers (hunters, or anything without a facing) see in every
        // direction — draw the full circle. Everyone else sees a forward wedge
        // (radius = detectionRadius, span = visionConeDegrees, centered on
        // facing). atan2(dy, dx) matches Phaser's screen-space angle (y down).
        const omni = this.archetype === 'hunter'
            || !this.facing
            || (this.facing.dx === 0 && this.facing.dy === 0)

        if (omni) {
            g.fillCircle(cx, cy, r)
            g.strokeCircle(cx, cy, r)
        } else {
            const facingAngle = Math.atan2(this.facing.dy, this.facing.dx)
            const half = (this.effectiveVisionCone / 2) * (Math.PI / 180)
            g.slice(cx, cy, r, facingAngle - half, facingAngle + half, false)
            g.fillPath()
            g.strokePath()
        }
    }

    syncOrderIndicator(visibleByFog) {
        if (!this.sprite || !this.orderIndicator) return
        const hasOrder = this.currentOrder != null
        this.orderIndicator.visible = hasOrder && visibleByFog
        if (!this.orderIndicator.visible) return
        this.orderIndicator.x = this.sprite.x + this._orderIndicatorOffsetX
        this.orderIndicator.y = this.sprite.y + this._orderIndicatorOffsetY
    }

    syncStatusBadges(visibleByFog) {
        if (!this.sprite || !this.statusBadges) return
        const scene = this.sprite.scene
        const statuses = visibleByFog ? statusesOnEntity(this) : []

        const size = 3
        const step = size + 1
        const totalWidth = statuses.length > 0 ? statuses.length * step - 1 : 0
        const startX = this.sprite.x + (TILE_SIZE - totalWidth) / 2
        const y = this.sprite.y + this._statusBadgeOffsetY

        for (let i = 0; i < statuses.length; i++) {
            const color = STATUS_VALENCE_COLOR[statuses[i].valence] ?? STATUS_VALENCE_COLOR.mixed
            let badge = this.statusBadges[i]
            if (!badge) {
                badge = scene.add.rectangle(0, 0, size, size, color).setOrigin(0).setDepth(53)
                this.statusBadges[i] = badge
            }
            badge.setFillStyle(color)
            badge.x = startX + i * step
            badge.y = y
            badge.setVisible(true)
        }
        // Hide badges left over from a higher previous count.
        for (let i = statuses.length; i < this.statusBadges.length; i++) {
            this.statusBadges[i].setVisible(false)
        }
    }

    syncStatusFX(visibleByFog) {
        syncEntityStatusFX(this, visibleByFog)
    }

    syncWorldHpBar() {
        if (!this.sprite || !this.worldHpBg) return

        const bx = this.sprite.x + this._hpBarOffsetX
        const by = this.sprite.y + this._hpBarOffsetY
        this.worldHpBg.x = bx
        this.worldHpBg.y = by
        this.worldHpFill.x = bx
        this.worldHpFill.y = by

        if (this.healthPoints < this._lastKnownHp) {
            this._turnsSinceDamage = 0
            this._showHpBar()
        }
        this._lastKnownHp = this.healthPoints

        this._maxHp = Math.max(this._maxHp || 0, this.healthPoints, 1)
        const ratio = Math.max(0, Math.min(this.healthPoints / this._maxHp, 1))
        this.worldHpFill.scaleX = ratio
    }

    _showHpBar() {
        if (this._hpBarVisible) return
        this._hpBarVisible = true
        this.sprite.scene.tweens.add({
            targets: [this.worldHpBg, this.worldHpFill],
            alpha: 1,
            duration: 200
        })
    }

    _hideHpBar() {
        if (!this._hpBarVisible) return
        this._hpBarVisible = false
        this.sprite.scene.tweens.add({
            targets: [this.worldHpBg, this.worldHpFill],
            alpha: 0,
            duration: 400
        })
    }

    createUI(config) {
        let scene = config.scene
        let x = config.x
        let y = config.y

        this.UIsprite = scene.add.sprite(x, y, "tiles", this.tile)
            .setOrigin(0)
            .setInteractive({ useHandCursor: true })

        if (this.tint) {
            this.UIsprite.tint = this.tint
        }

        this.UIsprite.on("pointerup", pointer => {
            if (pointer.leftButtonReleased()) {
                dungeon.describeEntity(this)
            }
        })
        this.UItext = scene.add.text(x + 20, y, this.name, { font: '12px Arial', fill: '#cfc6b8' })
            .setInteractive({ useHandCursor: true })
        this.UItext.on("pointerup", pointer => {
            if (pointer.leftButtonReleased()) {
                dungeon.describeEntity(this)
            }
        })

        return 30
    }
}
