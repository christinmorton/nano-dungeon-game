import Phaser from 'phaser'
import dungeon from "../Dungeon.js"
import Taggable from '../Taggable.js'
import run from '../Run.js'
import account from '../Account.js'
import HeroHUD from '../screens/HeroHUD.js'
import HeroInventory from './HeroInventory.js'
import HeroController from './HeroController.js'
import inputMap from '../InputMap.js'
import Stats from './Stats.js'
import { abilityByName } from './abilities/abilityRegistry.js'
import { makeItem } from '../items/itemProfiles.js'
import MeleeWeapon from '../items/MeleeWeapon.js'
import gameLog from '../GameLog.js'
import { affinityFor, empowermentMult, MAX_EMPOWER_TIER } from '../abilities/affinities.js'
import { advancedBasePassive, rollBasicPassive as pickRandomBasicPassive } from '../abilities/affinityPassives.js'
import { affinityPathDef, isEmpoweredPath, MAX_PATH_RANK } from '../abilities/affinityPaths.js'
import { convertToAlly, revertAllegiance } from '../companions/allegiance.js'
import { PACT_IS_TITHE } from '../../data/cosmicBeings.js'
import forsaken from '../tags/forsaken.js'
import tithe from '../tags/tithe.js'

// Innate unarmed strike — the universal fallback so EVERY class can bump-attack an
// adjacent foe, even with a ranged weapon that can't fire point-blank (the Elf's
// bow, minRange 3) or no melee weapon at all (the Wizard). STR-scaled, weak.
const UNARMED_PROFILE = {
    itemClass: 'MeleeWeapon', weaponCategory: 'fist', name: 'Fists',
    damageMin: 1, damageMax: 2, range: 1, attackPowerStat: 'attackPower',
}
import { syncEntityStatusFX } from '../Animations.js'
import { reactHeroStatus } from '../dialog/heroReactions.js'

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
        // Run skillbook (§14): every ability instance ACQUIRED this run — equipped
        // AND benched. The in-run Skillbook lists/swaps from here; benched ones keep
        // their rank. Run-scoped by nature (the hero is rebuilt each run; the account
        // skillbook persists separately). Seeded by applyProfile, grown by learnAbility.
        this.collection = []
        // Affinity slots (§18 two-slot): a swappable BASIC element + a bound ADVANCED
        // cosmic type (see abilities/affinities.js); either null. BOTH layer their
        // element onto outgoing damage and stack. `_suppressedBasic` stashes a basic
        // affinity that a forced Curse has overtaken, so a Shrine cleanse can restore
        // it. Run-scoped; the same fields work for enemies/sentient items later.
        this.affinityBasic = null
        // Empowerment tier of the basic slot: 0 = plain (essence/quest), 1 = empowered
        // (a mythical beast's gift). Scales the basic slot's damage bonus + stat payload;
        // a future upgrade node increments the same field. See abilities/affinities.js.
        this.affinityBasicTier = 0
        this.affinityAdvanced = null
        this._suppressedBasic = null
        // The Passive INSTANCES the affinity slots have attached (basic = rolled/
        // drafted from the pool; advanced = the fixed base passive). Tracked so a
        // swap/cleanse can detach exactly the right one. See affinityPassives.js.
        this._basicPassive = null
        this._advancedPassive = null
        // Affinity upgrade-tree paths (§19): a signature forks into ~3 thematic paths;
        // investing affinity shards attaches a path's passive and ranks it up. Map
        // pathKey -> { rank, passive, affinity }. Run-scoped. Only seraphic has paths
        // in the first slice; the tags read their rank live off this map.
        this.affinityPaths = {}
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

    // Override Taggable.addTag to give the hero a voice when a NEW negative
    // status lands. Only fires on a genuinely new tag (addTag dedupes by
    // name); reactHeroStatus filters to negative-valence statuses, so buffs
    // and trait tags stay quiet.
    addTag(template) {
        const isNew = !(this._tags && this._tags.includes(template.name))
        super.addTag(template)
        if (isNew) reactHeroStatus(this, template.name)
        return this
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

    // Re-apply banked abilities onto the bar at run start (§14 B4) — the read
    // counterpart of the B3 extraction commit. `keys` is the player's pre-run
    // picker selection (Loadout); omit it to apply the whole account book. Fills
    // free slots in order; abilities already in the class kit are skipped
    // (learnAbility dedupes by key) and overflow beyond the free slots is dropped.
    // record:false so re-applying banked abilities doesn't re-buffer them as
    // "learned this run."
    applyAccountBook(keys = account.getLearnedAbilities()) {
        for (const key of keys) {
            this.learnAbility(key, { record: false })
        }
        return this
    }

    // --- In-run Skillbook: equip / swap from the collection (§14) ---------------

    // Collection abilities not currently on the bar (the "bench").
    benchedAbilities() {
        return this.collection.filter(a => a && !this.abilities.includes(a))
    }

    // Equip a collection ability into a bar slot. Enforces the slot kind — an
    // ultimate-tier ability only fits the ultimate (R) slot, and a normal ability
    // only fits a normal slot. Whoever occupied the slot simply stops being
    // referenced by the bar (it stays in the collection = benched). If `ability`
    // was already equipped elsewhere, that's treated as a move. Returns false on an
    // illegal placement.
    equipAbility(ability, slotIndex) {
        if (!ability || !this.collection.includes(ability)) return false
        const ultimateSlot = inputMap.ultimateSlotIndex
        if (slotIndex < 0 || slotIndex > ultimateSlot) return false
        if ((ability.tier === 'ultimate') !== (slotIndex === ultimateSlot)) return false
        const prev = this.abilities.indexOf(ability)
        if (prev >= 0) this.abilities[prev] = undefined
        this.abilities[slotIndex] = ability
        this.refreshUI?.()
        return true
    }

    // Pull the ability in a bar slot back to the bench (it stays in the collection).
    unequipAbility(slotIndex) {
        if (this.abilities[slotIndex]) {
            this.abilities[slotIndex] = undefined
            this.refreshUI?.()
        }
        return this
    }

    // --- Affinity (§14, two-slot §18) -------------------------------------------

    // Grant an affinity, routed by TIER into the two-slot model (§18):
    //   - BASIC -> the swappable `affinityBasic` slot.
    //   - ADVANCED -> the bound `affinityAdvanced` slot.
    // Both slots can be filled at once and both stack. Returns
    // { ok, reason?, name?, swapped? }; reasons: 'unknown', 'same', 'pact'.
    grantAffinity(key, opts = {}) {
        const aff = affinityFor(key)
        if (!aff) return { ok: false, reason: 'unknown' }
        return aff.tier === 'advanced'
            ? this._grantAdvancedAffinity(key, aff)
            : this._grantBasicAffinity(key, aff, opts)
    }

    // Basic slot — SWAPPABLE. A DIFFERENT element reverses the old basic's stat
    // payload + detaches its pool passive, then attunes the new (the caller then
    // rolls/drafts the new passive). The SAME element is a REROLL — affinity stays,
    // the caller re-rolls the pool passive (setBasicPassive replaces it). Coexists
    // with the advanced slot. Returns { ok, name, swapped?, reroll? }.
    _grantBasicAffinity(key, aff, { empowered = false } = {}) {
        const newTier = empowered ? 1 : 0
        if (this.affinityBasic === key) {
            // Same element: normally just a passive REROLL. If the grant CHANGES the
            // empowerment tier (a beast empowering the element you already hold),
            // re-apply the stat payload at the new tier before the caller rerolls.
            if (newTier !== (this.affinityBasicTier || 0)) {
                this._applyAffinityPayload(aff, -1, this.affinityBasicTier || 0)
                this.affinityBasicTier = newTier
                this._applyAffinityPayload(aff, 1, newTier)
            }
            return { ok: true, name: aff.label, reroll: true, empowered: newTier > 0 }
        }
        if (this.affinityBasic) {
            this._applyAffinityPayload(affinityFor(this.affinityBasic), -1, this.affinityBasicTier || 0)
            this.removeBasicPassive()
        }
        this.affinityBasic = key
        this.affinityBasicTier = newTier
        this._applyAffinityPayload(aff, 1, newTier)
        gameLog.log(`${this.name} attunes to ${aff.label}${newTier > 0 ? " (empowered)" : ""}.`)
        this.refreshUI?.()
        return { ok: true, name: aff.label, swapped: true, empowered: newTier > 0 }
    }

    // Advanced slot — BOUND. A pact already held can't be displaced by a normal
    // grant (forced Curse gets its own suppress path in Phase 3). Attaches the
    // affinity's FIXED base passive (affinityPassives.js). Coexists with the basic
    // slot. reasons: 'same', 'pact'.
    _grantAdvancedAffinity(key, aff) {
        const current = this.affinityAdvanced
        if (current === key) return { ok: false, reason: 'same', name: aff.label }
        if (current) return { ok: false, reason: 'pact', name: affinityFor(current)?.label }
        this.affinityAdvanced = key
        this._applyAffinityPayload(aff, 1)
        this._advancedPassive = this._attachPassive(advancedBasePassive(key))
        gameLog.log(`${this.name} is bound to ${aff.label}.`)
        this.refreshUI?.()
        return { ok: true, name: aff.label }
    }

    // Apply (+1) or reverse (-1) an affinity's STAT payload via upgradeBaseStat (so a
    // CON change also moves maxHP; a negative amount cleanly subtracts). Passives are
    // handled separately (the pool/base-passive lifecycle below), not here.
    _applyAffinityPayload(aff, sign = 1, tier = 0) {
        if (!aff) return
        const mult = empowermentMult(tier)
        for (const [stat, n] of Object.entries(aff.statBonus || {})) {
            this.upgradeBaseStat(stat, sign * Math.round(n * mult))
        }
    }

    // --- Affinity passive lifecycle (§18) ---------------------------------------
    // Attach / detach a Passive instance, tracking it in this.passives.
    _attachPassive(PassiveClass) {
        if (!PassiveClass) return null
        const passive = new PassiveClass(this)
        this.passives.push(passive)
        passive.apply?.()
        return passive
    }
    _detachPassive(instance) {
        if (!instance) return
        const i = this.passives.indexOf(instance)
        if (i >= 0) this.passives.splice(i, 1)
        instance.remove?.()
    }

    // Set (replacing any current) the basic slot's pool passive. null clears it.
    setBasicPassive(PassiveClass) {
        this.removeBasicPassive()
        this._basicPassive = this._attachPassive(PassiveClass)
        this.refreshUI?.()
    }
    removeBasicPassive() {
        if (this._basicPassive) { this._detachPassive(this._basicPassive); this._basicPassive = null }
    }
    // Common-essence path: roll a RANDOM passive from the current basic affinity's pool.
    rollBasicPassive() {
        this.setBasicPassive(pickRandomBasicPassive(this.affinityBasic))
    }

    // Upgrade tree "Empower" node: buy one empowerment tier for the CURRENT basic
    // affinity (paid in affinity shards by the Skillbook). Reapplies the stat payload
    // at the higher tier; the per-hit bonus scaling reads affinityBasicTier live.
    // Capped at MAX_EMPOWER_TIER. Returns true if it advanced. Lost on a basic swap,
    // like the base empowerment tier — it's invested in your current attunement.
    empowerCurrentAffinity() {
        if (!this.affinityBasic) return false
        const tier = this.affinityBasicTier || 0
        if (tier >= MAX_EMPOWER_TIER) return false
        const aff = affinityFor(this.affinityBasic)
        this._applyAffinityPayload(aff, -1, tier)
        this.affinityBasicTier = tier + 1
        this._applyAffinityPayload(aff, 1, tier + 1)
        gameLog.log(`${this.name}'s ${aff.label} affinity deepens (tier ${tier + 1}).`)
        this.refreshUI?.()
        return true
    }

    // --- Affinity upgrade-tree paths (§19) --------------------------------------
    // Invest a shard rank into one of `affinityKey`'s signature paths. A NEW path
    // attaches its passive at rank 1; an EXISTING one just bumps its rank (the path's
    // tag reads the rank live, so no re-attach). Rank is capped at MAX_PATH_RANK.
    // Shard cost/gating is the caller's job (UpgradeScreen spends run.affinityShards).
    // Returns { ok, reason, rank, name }. reasons: 'unknown' (no such path), 'max'.
    investAffinityPath(affinityKey, pathKey) {
        const def = affinityPathDef(affinityKey, pathKey)
        if (!def) return { ok: false, reason: 'unknown' }
        // Demi-god (empowered) paths are gated behind empowerment: a plain basic can't
        // buy into the deep tree until a mythical beast's boon lifts it (tier > 0).
        if (isEmpoweredPath(affinityKey, pathKey) && affinityKey === this.affinityBasic && (this.affinityBasicTier || 0) === 0) {
            return { ok: false, reason: 'not-empowered', name: def.label }
        }
        const existing = this.affinityPaths[pathKey]
        if (existing) {
            if ((existing.rank || 0) >= MAX_PATH_RANK) return { ok: false, reason: 'max', name: def.label, rank: existing.rank }
            existing.rank += 1
            this.refreshUI?.()
            gameLog.log(`${this.name} deepens ${def.label} (rank ${existing.rank}).`)
            return { ok: true, reason: 'deepened', rank: existing.rank, name: def.label }
        }
        // Exclusive (user 2026-07-04): ONE path per affinity — committing to a path
        // LOCKS the other two for this run (no refunds). Deepening the chosen path
        // (handled above) is unaffected; only taking a SECOND path is refused.
        const chosen = this._chosenPathFor(affinityKey)
        if (chosen) return { ok: false, reason: 'locked', name: def.label, chosen }
        const passive = this._attachPassive(def.PassiveClass)
        this.affinityPaths[pathKey] = { rank: 1, passive, affinity: affinityKey }
        this.refreshUI?.()
        return { ok: true, reason: 'taken', rank: 1, name: def.label }
    }

    // Rank of a path the hero has invested in (0 = untaken).
    affinityPathRank(pathKey) { return this.affinityPaths?.[pathKey]?.rank || 0 }

    // The one path committed for `affinityKey` this run (exclusive model), or null.
    _chosenPathFor(affinityKey) {
        for (const [key, entry] of Object.entries(this.affinityPaths)) {
            if (entry.affinity === affinityKey) return key
        }
        return null
    }

    // Detach every path passive and clear the map — called when the affinity that
    // owns them leaves (a pact ending). Paths are tied to their attunement.
    _clearAffinityPaths(affinityKey = null) {
        for (const [key, entry] of Object.entries(this.affinityPaths)) {
            if (affinityKey && entry.affinity !== affinityKey) continue
            this._detachPassive(entry.passive)
            delete this.affinityPaths[key]
        }
        this.refreshUI?.()
    }
    // Cleanse path (Phase 3): detach the advanced slot's base passive.
    removeAdvancedPassive() {
        if (this._advancedPassive) { this._detachPassive(this._advancedPassive); this._advancedPassive = null }
    }

    // Force the CURSE affinity (§18) — the parasitic advanced attunement, from a
    // Cursed Gem. Rejected if a real pact already holds the advanced slot. Otherwise
    // SUPPRESSES the basic affinity: stash it (+ its rolled passive) in
    // `_suppressedBasic`, reverse its payload/passive, then bind Curse + attach its
    // Deepening Corruption base passive. Reversible only via a Shrine cleanse.
    forceCurse() {
        if (this.affinityAdvanced && this.affinityAdvanced !== 'curse') {
            gameLog.log(`${this.name}'s ${affinityFor(this.affinityAdvanced)?.label} pact repels the curse.`)
            return { ok: false, reason: 'rejected' }
        }
        if (this.affinityAdvanced === 'curse') return { ok: false, reason: 'same' }
        if (this.affinityBasic) {
            this._suppressedBasic = { key: this.affinityBasic, tier: this.affinityBasicTier || 0, passiveClass: this._basicPassive?.constructor || null }
            this._applyAffinityPayload(affinityFor(this.affinityBasic), -1, this.affinityBasicTier || 0)
            this.removeBasicPassive()
            this.affinityBasic = null
            this.affinityBasicTier = 0
        }
        this.affinityAdvanced = 'curse'
        this._applyAffinityPayload(affinityFor('curse'), 1)
        this._advancedPassive = this._attachPassive(advancedBasePassive('curse'))
        gameLog.log(`A curse takes hold of ${this.name}!`)
        this.refreshUI?.()
        return { ok: true }
    }

    // Shrine cleanse of the curse: strip Curse from the advanced slot (its passive's
    // cleanup returns any conduit-decayed stats) and RESTORE the stashed basic
    // affinity + the exact passive it had. No-op if not cursed / nothing stashed.
    restoreSuppressedBasic() {
        const wasCursed = this.affinityAdvanced === 'curse'
        if (wasCursed) {
            this._applyAffinityPayload(affinityFor('curse'), -1)
            this.removeAdvancedPassive()
            this.affinityAdvanced = null
        }
        if (this._suppressedBasic) {
            const { key, tier, passiveClass } = this._suppressedBasic
            this._suppressedBasic = null
            this.affinityBasic = key
            this.affinityBasicTier = tier || 0
            this._applyAffinityPayload(affinityFor(key), 1, tier || 0)
            if (passiveClass) this.setBasicPassive(passiveClass)
        }
        this.refreshUI?.()
        return wasCursed
    }

    // --- Pacts (§17) — a bargain with a cosmic being -----------------------------
    // A pact BINDS the being's advanced affinity (its power + rider + base passive)
    // and flips the being to your side; it's the offered/earned entry to the bound
    // advanced slot. One pact at a time (the advanced slot is single + bound).
    // Offered/accepted in-world via CosmicBeing.onInteract (dialog, no screen).
    acceptPact(being) {
        if (this._pact) return { ok: false, reason: 'already-pacted' }
        const key = being?.pactAffinity
        if (!key) return { ok: false, reason: 'no-offer' }
        const r = this.grantAffinity(key)          // advanced -> bound slot + base passive
        if (!r?.ok) return r
        this._pact = { affinity: key, being }
        convertToAlly(being, this)                 // the pact-bound now serves you
        dungeon.enforceCosmicFollowerCap(this)     // one god active at a time — surplus benches
        being.pactSealed = true
        being.pactPending = false
        // Void-aligned pacts (void / demonic) exact an ongoing tithe; Light-aligned
        // ones are a pure boon. See tags/tithe.js.
        if (PACT_IS_TITHE.has(key)) this.addTag(tithe)
        return { ok: true, name: r.name, affinity: key, being }
    }

    // Strip the pact's affinity (+ its passive + any tithe) and clear `_pact`. The
    // shared teardown behind both ways a pact ends. Returns the ended pact's data.
    _endPact() {
        const pact = this._pact
        this._pact = null
        this._applyAffinityPayload(affinityFor(pact.affinity), -1)
        this.removeAdvancedPassive()
        this._clearAffinityPaths(pact.affinity)    // its upgrade-tree paths end with it
        this.affinityAdvanced = null
        this.removeTag(tithe)                      // the tithe ends with the pact
        return pact
    }

    // BREAK the pact (the raw, free exit): the power fades AND the pact-bound TURNS
    // ON YOU — reverts to a hostile hunter (the boundSpirit rogue pattern) — and you
    // bear the Forsaken mark of broken faith. The costly-but-safe alternative is a
    // Shrine dissolve (dissolvePact).
    breakPact() {
        if (!this._pact) return { ok: false, reason: 'no-pact' }
        const { affinity, being } = this._endPact()
        this.addTag(forsaken)                      // broken faith leaves a mark
        if (being && being.healthPoints > 0) {
            revertAllegiance(being, { team: 'monster', type: 'enemy', archetype: 'hunter' })
            being.pactSealed = false
            being.sayPactBroken?.()
        }
        gameLog.log(`${this.name} breaks the pact — ${affinityFor(affinity)?.label} power fades, and the pact-bound turns hostile.`)
        this.refreshUI?.()
        return { ok: true, affinity, being }
    }

    // DISSOLVE the pact cleanly (a Shrine rite): the power fades and the pact-bound
    // is RELEASED peacefully (it departs — removed from the world, no hostility, no
    // Forsaken mark). The faithful, costlier way out (the Shrine charges for it).
    dissolvePact() {
        if (!this._pact) return { ok: false, reason: 'no-pact' }
        const { affinity, being } = this._endPact()
        if (being) {
            // Drop the party reference (removeEntity tears down tm + sprite but not
            // party membership) so no stale ally lingers, then release it.
            if (Array.isArray(this.party)) {
                const i = this.party.indexOf(being)
                if (i >= 0) this.party.splice(i, 1)
            }
            dungeon.removeEntity(being)             // released; departs without malice
        }
        gameLog.log(`${this.name}'s pact is dissolved — the bond released cleanly.`)
        this.refreshUI?.()
        return { ok: true, affinity, being }
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
        // Mastery-through-use: channeling your element into a foe accrues affinity
        // shards (the upgrade-tree currency). Only while attuned — an unattuned hit
        // carries no element to master.
        if (dealt > 0 && this.affinityBasic) run.awardAffinityMastery(dealt)
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
    // mage/cleric/elf profiles, present on warrior/dwarf. Default 0
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
        const speed = account.getPreferences().heroSpeed ?? 1
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
