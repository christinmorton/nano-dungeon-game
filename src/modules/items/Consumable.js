import GenericItem from "./GenericItem.js"
import gameLog from "../GameLog.js"
import dungeon from "../Dungeon.js"
import account from "../Account.js"
import { attuneAffinity } from "../abilities/attune.js"

// Generic placeholder item for catalog content whose SYSTEM isn't built yet:
// throwables, deployable traps, runes, reagents, tomes, boosters, utility
// scrolls/items. Carries the full profile DATA (throwRange, aoeRadius, damage,
// status, buff, grants, teaches, effect, …) so the future system reads it; for
// now `equip()` (the "use" path) just logs that the mechanic is pending.
// Reagents are passive crafting inputs — no active use. See
// documents/v3_known_issues.md #47.

const PENDING_VERB = {
    Throwable: "can't be thrown yet",
    Deployable: "can't be deployed yet",
    Rune: "can't be etched into gear yet",
    Tome: "can't be studied yet",
    Booster: "has no effect yet",
    Relic: "can't safeguard your memory yet",
    Consumable: "has no effect yet",
}

export default class Consumable extends GenericItem {
    constructor(x, y, profile) {
        super(x, y, profile.tile ?? 670, profile.tint, profile.art)
        this.profile = profile
        this.name = profile.name
        this.description = profile.description
        this.slot = profile.slot ?? null
        this.category = profile.itemClass || 'Consumable'
    }

    // "Use" path (digit key on an unslotted item). HeroInventory.toggleAt calls
    // equip(itemNumber, hero). Most categories are still placeholders that DON'T
    // consume the item; Tomes are the first live system (the learn-grant, §14 B2).
    equip(itemNumber, hero) {
        if (this.category === 'Reagent') {
            gameLog.log(`${this.name} — a crafting reagent. No use until alchemy is added.`)
            return
        }
        if (this.category === 'Tome' && this.profile.teaches) {
            return this._study(itemNumber, hero)
        }
        if (this.category === 'Affinity' && this.profile.affinity) {
            return this._attune(itemNumber, hero)
        }
        if (this.category === 'Relic' && this.profile.effect === 'grantRosterSlot') {
            return this._grantRosterSlot(itemNumber, hero)
        }
        if (this.category === 'Relic' && this.profile.effect === 'grantReviveToken') {
            return this._grantReviveToken(itemNumber, hero)
        }
        const verb = PENDING_VERB[this.category] || "has no effect yet"
        gameLog.log(`${this.name} ${verb} (system pending).`)
    }

    // The Guild Charter relic (§ hero-roster §5): redeem for a PERMANENT account
    // roster slot. Meta effect — it grows the Guild Hall's living-hero capacity,
    // not the in-run hero. Consumed on redeem.
    _grantRosterSlot(itemNumber, hero) {
        const cap = account.redeemRosterExpansion()
        gameLog.log(`${this.name} is redeemed — your hall can now hold ${cap} heroes.`)
        const reader = hero || dungeon.player
        if (reader?.removeItem) reader.removeItem(itemNumber)
    }

    // The Ember of Return relic (§ hero-roster §8): kindling it banks a revive token
    // on the account. The actual revival — spending a token on a chosen FALLEN hero —
    // happens at the Guild Hall (which alone can pick the target). Consumed on use.
    _grantReviveToken(itemNumber, hero) {
        const tokens = account.grantReviveToken()
        gameLog.log(`${this.name} is kindled — a fallen hero may be called back at your hall. (Embers held: ${tokens})`)
        const reader = hero || dungeon.player
        if (reader?.removeItem) reader.removeItem(itemNumber)
    }

    // Studying a tome IS the learn-grant consumer: teach the named ability to the
    // reader via hero.learnAbility (the reusable verb). Consume the tome only on a
    // successful learn — a wasted tome on a failed study would be a feel-bad.
    // Learning ignores `classGate` by design (soft gating, §7.3): anyone may study
    // any tome; the stat/`requires` gate decides whether they can later cast it.
    _study(itemNumber, hero) {
        const reader = hero || dungeon.player
        if (!reader?.learnAbility) {
            gameLog.log(`${this.name} — there is no one here who can study it.`)
            return
        }
        const result = reader.learnAbility(this.profile.teaches)
        if (result.ok) {
            const tail = result.equipped ? "" : " (bar full — equip it next run from your loadout)"
            gameLog.log(`${reader.name} studies ${this.name} and learns ${result.name}!${tail}`)
            reader.removeItem(itemNumber)
            return
        }
        const REASONS = {
            unknown: `The pages of ${this.name} are unreadable — its teaching is lost.`,
            passive: `${result.name} cannot be studied from a tome.`,
            known: `${reader.name} already knows ${result.name}.`,
        }
        gameLog.log(REASONS[result.reason] || `${this.name} cannot be studied right now.`)
    }

    // Absorbing an affinity essence (§14): grant its affinity via hero.grantAffinity
    // (the locked one-time attunement). Consumed only on a successful first
    // attunement — a hero who already has an affinity can't take another, and keeps
    // the essence. grantAffinity logs the attunement itself.
    _attune(itemNumber, hero) {
        const reader = hero || dungeon.player
        if (!reader?.grantAffinity) {
            gameLog.log(`${this.name} — there is no one here who can absorb it.`)
            return
        }
        // attuneAffinity owns the grant + POOL-passive flow (roll one at random, or —
        // for a rare `passiveSelect` essence — stage a draft and open the DraftScreen).
        // grantAffinity inside it owns the swap rules: attune, SWAP a basic affinity,
        // or refuse when bound by a pact. Same-element reroll lands on ok too.
        const result = attuneAffinity(reader, this.profile.affinity, { passiveSelect: this.profile.passiveSelect })
        if (result.ok) {
            reader.removeItem(itemNumber)   // grantAffinity logged the attune; any draft is already open
            return
        }
        const REASONS = {
            same: `${reader.name} is already attuned to ${result.name}.`,
            pact: `${reader.name} is bound by the ${result.name} pact — ${this.name} cannot displace it.`,
            unknown: `${this.name} fizzles — its affinity is unknown.`,
        }
        gameLog.log(REASONS[result.reason] || `${this.name} has no effect right now.`)
    }
}
