import Phaser from 'phaser'
import dungeon from "../Dungeon.js"
import Taggable from '../Taggable.js'
import run from '../Run.js'
import prefs from '../Prefs.js'
import HeroHUD from '../screens/HeroHUD.js'
import HeroInventory from './HeroInventory.js'
import HeroController from './HeroController.js'
import inputMap from '../InputMap.js'
import Stats from './Stats.js'
import { abilityByName } from './abilities/abilityRegistry.js'
import { makeItem } from '../items/itemProfiles.js'
import MeleeWeapon from '../items/MeleeWeapon.js'
import gameLog from '../GameLog.js'

// Innate unarmed strike — the universal fallback so EVERY class can bump-attack an
// adjacent foe, even with a ranged weapon that can't fire point-blank (the Ranger's
// bow, minRange 3) or no melee weapon at all (the Wizard). STR-scaled, weak.
const UNARMED_PROFILE = {
    itemClass: 'MeleeWeapon', weaponCategory: 'fist', name: 'Fists',
    damageMin: 1, damageMax: 2, range: 1, attackPowerStat: 'attackPower',
}
import { syncEntityStatusFX } from '../Animations.js'

// Base-plus-sources reducer (from documents/v3_combat_stats_system.md):
//   stat(name) = base + sum(equipment contributions) + sum(passives)
// Base is derived from this.stats per the formulas in the design doc.
// Equipment contributions come from inventory.statContribution(name).
// Passive contributions flow through this.statContribution(name) —
// a shim that returns 0, wrapped by Taggable when a tag with a
// `statContribution` handler is added (Bulwark, Enrage, future buffs).

export default class BaseHero extends Taggable{
    constructor(x, y) {
        super()

        this.name = "The Hero"
        this.movementPoints = 2
        this.maxMovementPoints = 2
        this.actionPoints = 1
        this.maxActionPoints = 1
        this.x = x
        this.y = y
        this.tile = 25
        this.moving = false
        this.type = "hero"
        // Allegiance for the targeting seam (modules/Targeting.js). The hero
        // and its allies/summons are team "player"; enemies are "monster".
        this.team = "player"
        this.inventory = new HeroInventory(this)
        this.quest_items = []
        this.tallies = { coins: 0, keys: 0 }
        this._speedAccumulator = 0
        // The equipped bar: a sparse array, slot index -> Ability instance. Each
        // equipped instance is ALSO in `collection` (the bar references the roster).
        this.abilities = []
        // Every ability instance the hero holds. applyProfile seeds it from the
        // class kit; learnAbility grows it.
        this.collection = []
        this.passives = []
        // Party roster — the hero's followers tracked as a group (companions/
        // Follower.js push/pull themselves here on spawn/death). The minimal
        // "party system": a single pet is a Follower; a party is several
        // Followers sharing this leader, organized by this roster. Party-wide
        // features (HUD, formation, commands) build on it later.
        this.party = []
        // Reserve bench: followers the hero OWNS but hasn't manifested — benched by the
        // active-god cap (or a future Dismiss). Kept on the hero so they survive floor
        // transitions; Beckon brings one back. See the Dungeon follower-roster API.
        this.followerBench = []
        this.statusFX = {}

        // Default stat sheet — blank. applyProfile() replaces this with
        // the chosen class's Stats and runs applyMaxHPFromStats().
        this.stats = new Stats()
        this.maxHealthPoints = 30
        this.healthPoints = this.maxHealthPoints
    }


    // Apply a class profile to this hero. Profiles are data objects in
    // classes/profiles/ — they replaced the per-class subclasses so the
    // same machinery can later give an enemy a "champion" stat sheet
    // without a separate type system. Profile shape:
    //   { name, tile, stats, hpFormula(stats), classArmorBase?(stats),
    //     startingItems: [ItemClass, ...], tags: [tagTemplate, ...] }
    applyProfile(profile, { lean = false } = {}) {
        if (!profile) return this
        this.profile = profile
        this.name = profile.name
        this.tile = profile.tile
        this.art = profile.art
        this.stats = Stats.from(profile.stats)
        this.applyMaxHPFromStats()

        // startingItems entries can be either profile-name strings (for
        // profile-based weapons/armor — built via makeItem) or class
        // refs (for behavior-varied items like potions that remain as
        // subclasses).
        for (const itemSpec of (profile.startingItems || [])) {
            const item = typeof itemSpec === 'string'
                ? makeItem(itemSpec)
                : new itemSpec()
            this.inventory.items.push(item)
            // Slotted items (weapons, armor) auto-equip; unslotted items
            // (potions, utility scrolls) stay in carry.
            if (item.slot) {
                this.inventory.equipFromCarry(item)
            }
        }

        for (const tag of (profile.tags || [])) {
            this.addTag(tag)
        }

        // Per documents/v3_abilities.md: hero owns ability instances so
        // per-instance cooldown counters live with the hero, not the
        // class definition. Lean-start (§14): a build-your-own run begins with only
        // profile.starterAbility (the rest is drafted/learned through the run);
        // classic mode and enemy/champion profiles keep the full kit.
        const startingAbilities = (lean && profile.starterAbility)
            ? [profile.starterAbility]
            : (profile.abilities || [])
        this.abilities = startingAbilities.map(AbilityClass => new AbilityClass(this))

        // The Ultimate occupies the dedicated last bar slot (the R slot). It's a
        // separate profile field (not just the 6th ability) so it always lands in
        // the ultimate slot regardless of how many normal abilities a class carries.
        if (profile.ultimate) {
            this.abilities[inputMap.ultimateSlotIndex] = new profile.ultimate(this)
        }

        // Seed the run skillbook with the initially-equipped instances (starter/kit
        // + ultimate). learnAbility/applyAccountBook grow it as the run goes.
        this.collection = this.abilities.filter(Boolean)

        // Passives are the always-on counterpart: each subclass attaches
        // its trait tag(s) via apply(). The hero owns the instances so a
        // future selection screen can remove()/swap them.
        this.passives = (profile.passives || []).map(PassiveClass => new PassiveClass(this))
        for (const passive of this.passives) passive.apply()

        return this
    }

    // Learn an ability at runtime — the reusable "learn-grant" verb
    // (v3_ability_progression_system.md §14, Track B / B2). ANY source (a studied
    // tome, a milestone draft, a drop, a quest reward) calls this to ACQUIRE an
    // ability. Resolution goes through the central abilityRegistry, so callers pass
    // a display name or key ("Cleave"/"FrostBolt").
    //
    // Acquiring (not equipping) is the real "learn": the key is buffered for
    // extraction-gated persistence (§14 B3) so it banks to the account on a win and
    // can be equipped next run via the loadout picker (§14 B4). The bar is a FIXED
    // 5 + Ultimate, so a full-kit class can't auto-equip a new ability — it's
    // acquired-for-next-run instead. If a slot IS free, it also equips now.
    //
    // Learning is deliberately UNGATED by class (soft-gating model — §7.3); whether
    // the hero can FIRE an off-role ability is decided by canActivate's stat gates.
    //
    // Returns { ok, reason?, name, slot?, equipped? }. equipped=false means acquired
    // but the bar was full. Failure reasons: 'unknown', 'passive', 'known'.
    learnAbility(nameOrKey, { record = true } = {}) {
        const meta = abilityByName(nameOrKey)
        if (!meta) return { ok: false, reason: 'unknown', name: nameOrKey }
        if (meta.passive) return { ok: false, reason: 'passive', name: meta.name }
        // Ultimates are unique to each class (granted via profile.ultimate from run
        // start) and can never be learned/drafted by anyone. §14 / user 2026-06-29.
        if (meta.tier === 'ultimate') return { ok: false, reason: 'ultimate', name: meta.name }

        // Known if it's already in the run collection (equipped OR benched) — the
        // collection is the superset, so this covers the bar too.
        if (this.collection.some(a => a?.constructor?.name === meta.key)) {
            return { ok: false, reason: 'known', name: meta.name }
        }

        // Record the key for extraction-gated persistence (banks on a win). Only the
        // player persists; record:false (account-book re-apply at run start) skips.
        if (record && this.team === 'player') run.recordLearnedAbility(meta.key)

        // The instance ALWAYS joins the run collection (so a benched ability is a
        // real, swappable instance in the Skillbook). It also equips now if a slot
        // of the needed kind is free; otherwise it stays benched.
        const ability = new meta.Ability(this)
        this.collection.push(ability)

        const ultimateSlot = inputMap.ultimateSlotIndex
        let slot = -1
        if (ability.tier === 'ultimate') {
            if (!this.abilities[ultimateSlot]) slot = ultimateSlot
        } else {
            for (let i = 0; i < ultimateSlot; i++) {
                if (!this.abilities[i]) { slot = i; break }
            }
        }
        if (slot >= 0) {
            this.abilities[slot] = ability
            this.refreshUI?.()
        }
        return { ok: true, name: meta.name, slot: slot >= 0 ? slot : null, equipped: slot >= 0 }
    }


    // Called after this.stats is assigned so maxHP picks up the new CON.
    // Reads the formula from the active profile; falls back to a
    // middle-of-pack curve for a profile-less hero. Per "max is
    // canonical": set max first, derive current.
    applyMaxHPFromStats() {
        const formula = this.profile?.hpFormula ?? ((s) => 300 + s.CON * 20)
        this.maxHealthPoints = formula(this.stats)
        this.healthPoints = this.maxHealthPoints
    }

    // Run-scoped base-stat upgrade (§14 B7). Bumps a base stat by `amount` on
    // this.stats; derived stats (attackPower, dodge, magicPower, …) follow
    // automatically through _statBase. Run-scoped by nature — the hero rebuilds
    // from the class profile each run, so the bump is gone next run. A CON bump
    // raises maxHP by the formula delta and grants that HP (no free full-heal).
    upgradeBaseStat(name, amount = 1) {
        if (!(name in this.stats)) return false
        this.stats[name] += amount
        if (name === 'CON') {
            const formula = this.profile?.hpFormula ?? ((s) => 300 + s.CON * 20)
            const newMax = formula(this.stats)
            const delta = newMax - this.maxHealthPoints
            this.maxHealthPoints = newMax
            this.healthPoints = Math.min(this.maxHealthPoints, this.healthPoints + Math.max(0, delta))
        }
        this.refreshUI?.()
        return true
    }

    // Called once per scene-create by Dungeon.initializeEntity. Constructs
    // the controller and binds it to the world scene's input.
    setEvents() {
        // Tear down any prior controller's input listeners first. Revive
        // (revivePlayer -> initializeEntity -> setEvents) and floor re-placement
        // both re-enter here on a reused hero object; a leftover keyup handler
        // would double-fire movement (move N tiles per press). See HeroController.
        this.controller?.unbind()
        this.controller = new HeroController(this)
        this.controller.bind(dungeon.scene)
    }

    cleanup() {
        this.hud?.destroy()
        this.hud = null
        delete this.sprite
    }

    get items() { return this.inventory.items }
    set items(value) {
        // Bulk-assignment path (used by Dungeon when consuming pendingLoadout).
        // Replacing the whole carry list also clears equipped slots — the
        // profile pre-equipped a default weapon that's no longer owned,
        // so it should leave the slot too.
        this.inventory.items = value
        for (const slot of Object.keys(this.inventory.equippedSlots)) {
            this.inventory.equippedSlots[slot] = null
        }
    }

    toggleItem(itemNumber) { this.inventory.toggleAt(itemNumber) }
    removeItem(itemNumber) { this.inventory.removeAt(itemNumber) }
    dropItem(itemNumber) { this.inventory.dropAt(itemNumber) }
    unequipSlot(slotName) { this.inventory.unequipSlot(slotName) }
    removeItemByProperty(property, value) { this.inventory.removeByProperty(property, value) }
    equippedItems() { return this.inventory.equipped() }
    currentWeapon() { return this.inventory.currentWeapon() }

    // Shared innate fists weapon (lazily built) for adjacent bump-attacks the
    // equipped weapon can't make. See UNARMED_PROFILE.
    unarmed() {
        if (!this._unarmed) this._unarmed = new MeleeWeapon(0, 0, UNARMED_PROFILE)
        return this._unarmed
    }

    // Generic stat reducer. Returns base (from this.stats + derived
    // formula) plus equipment contributions plus passive/tag
    // contributions (the latter chains through Taggable wrapping).
    stat(name) {
        return this._statBase(name)
            + this.inventory.statContribution(name)
            + this.statContribution(name)
    }

    // Shim for Taggable to wrap. Tags with a `statContribution(running,
    // name)` handler accumulate their bonus into `running` and return
    // the new total; the wrapped chain returns the final sum.
    statContribution(name) { return 0 }

    // Combat event shims for Taggable to wrap — a passive tag adds an
    // onKill/onDodge/onDamaged handler that Combat.attack fires at the matching
    // moment (kill / successful dodge / surviving a hit). Base is a no-op so the
    // wrap has something to chain onto even with no passive equipped.
    onKill(victim) {}
    onDodge(attacker) {}
    onDamaged(attacker, dealt) {}
    // Attacker-side counterpart to onDamaged: fires on the ATTACKER each time it
    // deals damage (Combat.attack + resolveDamage), passed the victim and the HP
    // dealt. On-hit procs (Devour lifesteal) wrap it.
    onDealtDamage(victim, dealt) {
    }

    // Outgoing-accuracy shim for Taggable to wrap. Combat.attack calls this on the
    // ATTACKER before the victim's dodge roll; a status (Blind) wraps it to return
    // false so the swing whiffs. Base returns true = the attack lands normally.
    attackHits() { return true }

    // Incoming-damage multiplier shim for Taggable to wrap. resolveDamage and
    // Combat.attack multiply the final damage by this on the VICTIM; a status
    // (Marked) wraps it to amplify damage taken. Base 1 = no change.
    damageTakenMult() { return 1 }

    // Outgoing-damage multiplier shim — the attacker-side counterpart, passed the
    // VICTIM so a passive can scale damage by the target's state (Opportunist:
    // +damage vs a disabled foe). Applied on the ATTACKER in resolveDamage +
    // Combat.attack. Base 1 = no change.
    outgoingDamageMult(victim) { return 1 }

    // Incoming-heal multiplier shim for Taggable to wrap. universals.heal() scales
    // the heal amount by this on the RECIPIENT; an anti-heal status (Unmaking)
    // wraps it to deny restoration. Base 1 = full healing.
    incomingHealMult() { return 1 }

    // Armor/barrier penetration shim — the ATTACKER subtracts this much from the
    // victim's protection for `damageType` (Combat.attack + resolveDamage). A trait
    // (Arcane's Spell Pierce → magic) wraps it. Base 0 = no penetration.
    armorPen(damageType) { return 0 }

    // Combat recency — the hero's equivalent of BaseEnemy.isEngaged(). The damage
    // paths (Combat.attack / resolveDamage) call markCombat() whenever the hero
    // deals or takes a hit; refresh() ticks it down. inCombat() drives in-combat
    // passives like Momentum.
    markCombat() { this._combatRecency = 3 }   // ~3 turns of "in combat" memory
    inCombat() { return (this._combatRecency ?? 0) > 0 }

    _statBase(name) {
        const S = this.stats
        switch (name) {
            // Raw base stats
            case 'STR': return S.STR
            case 'DEX': return S.DEX
            case 'CON': return S.CON
            case 'SPD': return S.SPD
            case 'INT': return S.INT
            case 'Magic': return S.Magic

            // Derived stats — formulas from documents/v3_combat_stats_system.md
            // and documents/v3_magic_and_elements.md (rangedAttackPower).
            case 'attackPower': return S.STR
            case 'rangedAttackPower': return S.DEX + Math.floor(S.STR / 2)
            case 'magicPower': return S.Magic
            case 'maxHP': return 20 + S.CON * 2
            case 'block': return Math.floor((S.STR + S.CON) / 4)
            case 'dodge': return Math.floor((S.DEX + S.SPD) / 4)
            case 'barrier': return Math.floor(S.Magic / 2)
            // Armor base is class-shaped: Warrior/Dwarf profiles set
            // classArmorBase to floor(CON/5); other profiles omit it.
            case 'armor': return this.classArmorBase()
            case 'critChance': return 0.05
            case 'critMultiplier': return 2

            default: return 0
        }
    }

    // Class armor base comes from the active profile; absent on
    // mage/cleric/ranger profiles, present on warrior/dwarf. Default 0
    // for profile-less heroes.
    classArmorBase() {
        const formula = this.profile?.classArmorBase
        return formula ? formula(this.stats) : 0
    }

    dodgeChance() {
        return Math.min(0.5, this.stat('dodge') * 0.03)
    }

    blockChance() {
        return Math.min(0.5, this.stat('block') * 0.03)
    }

    // Combat surface. attack() rolls the weapon's damage at call time
    // and adds the weapon's power-stat base (attackPower / rangedAttack-
    // Power / magicPower per the weapon's profile). Enchanted weapons
    // (non-null damageFlavor) on a non-magicPower scaling stat add a
    // Magic-derived flavor bonus on top — see
    // documents/v3_magic_and_elements.md §"Magic scaling".
    // protection() splits into armor vs barrier by damage type so
    // Combat.js can apply the right reducer.
    attack() {
        const weapon = this.currentWeapon()
        const powerStat = weapon?.attackPowerStat ?? 'attackPower'
        const powerBase = this.stat(powerStat)
        const weaponRoll = weapon?.damage?.() ?? 0
        const flavorBonus = (weapon?.damageFlavor && powerStat !== 'magicPower')
            ? this.stat('magicPower')
            : 0
        return powerBase + weaponRoll + flavorBonus
    }

    protection(damageType = 'physical') {
        if (damageType === 'magic') return this.stat('barrier')
        if (damageType === 'true') return 0
        return this.stat('armor')
    }

    refresh() {
        const speed = prefs.getPreferences().heroSpeed ?? 1
        this._speedAccumulator += speed
        const turnsGranted = Math.floor(this._speedAccumulator)
        this._speedAccumulator -= turnsGranted

        this.movementPoints = this.maxMovementPoints * turnsGranted
        this.actionPoints = this.maxActionPoints * turnsGranted

        // Tick down combat recency (Momentum). Only counts rounds the hero
        // actually acts in (turnsGranted > 0), so a slow hero doesn't fall out of
        // combat between its turns.
        if (this._combatRecency > 0) this._combatRecency = Math.max(0, this._combatRecency - turnsGranted)

        // `?.` — the ability bar can be sparse (an Ultimate sits in the last slot
        // even when a class has fewer than 5 normal abilities, leaving a gap).
        for (const ability of this.abilities) {
            ability?.tickCooldown()
        }

        // Burn down an equipped light source (torch / beacon); it extinguishes
        // and a consumable one is removed from the offhand when spent.
        if (turnsGranted > 0) {
            const off = this.inventory.equippedSlots.offhand
            if (off?.isLightSource) off.burn(turnsGranted, this)
        }
    }

    turn() {
        // Channeled invocation (Siphon, …): auto-fire the locked tick this round
        // and spend the turn. The controller owns the state + break conditions.
        this.controller?.tickInvocation()

        // Continuous travel (shift+click): take the next path step when idle.
        this.controller?.tickTravel?.()

        if (this.healthPoints <= 6) {
            this.sprite.tint = Phaser.Display.Color.GetColor(255, 0, 0)
        }

        this.refreshUI()
    }

    over() {
        let isOver = this.movementPoints <= 0 && !this.moving

        this.hud?.setTurnOverStyle(isOver)

        if (isOver) {
            this.actionPoints = 0
        }

        return isOver
    }

    syncStatusFX(visibleByFog) {
        syncEntityStatusFX(this, visibleByFog)
    }

    onDestroy() {
        if (this.statusFX) Object.values(this.statusFX).forEach(fx => fx.destroy())
        run.heroDied()
    }

    createUI(config) {
        this.hud = new HeroHUD(this, config)
        this.hud.create()
    }

    refreshUI() {
        this.hud?.refresh()
    }
}
