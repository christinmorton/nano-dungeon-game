import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Twilight Brand — the Seraphic "off-spectrum radiance" path (§19). A free seraph's
// light is NEITHER Light nor Void — twilight. Mechanically that means UNBLOCKABLE:
// the brand is a DoT that subtracts HP directly (like Smitten), so neither armor,
// barrier, nor any future light/void mitigation can turn it aside — it is neither.
//
// TWO tags live here:
//   - `twilightBrand` (default) — the VICTIM-side DoT.
//   - `twilightBrander` — the HERO-side trait the path passive attaches; it wraps the
//     attacker's onDealtDamage hook to stamp the brand on whatever it hits. Rank
//     (read live off the attacker) scales the brand it stamps.

const BRAND_TINT = 0xb08cff

const twilightBrand = defineStatus({
    name: "Twilight Brand",
    category: "dot",
    valence: "negative",
    fx: "void",
    duration: 3,
    initialize: function (damage = 3, turns = 3) {
        this._twDamage = damage
        this._twTurns = turns
        this._twActivated = false
        this._twPrevTint = this.sprite?.tint
        if (this.sprite) {
            this.sprite.tint = BRAND_TINT
            this.sprite.tintFill = false
        }
        gameLog.log(`${this.name} is branded with twilight.`)
    },
    turn: function () {
        if (this._twTurns > 0 && !this._twActivated) {
            this._twActivated = true
            this.healthPoints -= this._twDamage
            gameLog.log(`${this.name} is seared by twilight for ${this._twDamage}.`)
            this._twTurns -= 1
        }
        if (this._twTurns <= 0) this.removeTag(twilightBrand)
    },
    refresh: function () {
        this._twActivated = false   // re-arm the once-per-round tick
    },
    cleanup: function () {
        if (this.sprite) {
            if (this._twPrevTint !== undefined) this.sprite.tint = this._twPrevTint
            else this.sprite.clearTint?.()
        }
    },
})

// Apply OR refresh Twilight Brand on a victim. Rank scales the per-tick damage; an
// already-branded victim keeps the stronger tick and refreshes duration (addTag alone
// can't do that — it dedupes by name; same pattern as applyAcid).
export function brandDamage(rank = 1) { return 2 + (rank || 1) }

export function applyTwilightBrand(victim, rank = 1) {
    if (!victim) return
    const dmg = brandDamage(rank)
    const turns = 3
    if (victim._tags?.includes("Twilight Brand")) {
        victim._twDamage = Math.max(victim._twDamage || 0, dmg)
        victim._twTurns = turns
    } else {
        victim.addTag(twilightBrand, dmg, turns)
    }
}

// Hero-side: on every hit the seraph lands, brand the victim. This is the tag the
// Twilight Brand path passive attaches to the seraph (NOT the victim DoT above).
export const twilightBrander = defineStatus({
    name: "Twilight Brander",
    category: "buff",
    valence: "mixed",
    duration: null,
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) {
            applyTwilightBrand(victim, this.affinityPaths?.twilight?.rank || 1)
        }
        return ret
    },
})

// Live state for the Skillbook path readout — the brand this seraph currently stamps.
export function twilightReadout(entity, rank = 1) {
    return `stamps ${brandDamage(rank)}/turn on hit · unblockable`
}

export default twilightBrand
