import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Corrupted — an arcane DoT: the victim is coming apart rather than burning or
// poisoned. Added 2026-09-20 as v5's twelfth status (scope doc §10.8, recorded
// before this file existed), for The Unraveling's lingering residue.
//
// It is deliberately GENERIC, not Unraveling-specific. Any future void or arcane
// effect can apply it; nothing here knows what spawned it.
//
// WHY NOT REUSE burning OR poison. A status communicates through its log line and
// its tint more than through its numbers. Burning says "is set ablaze" and tints
// fire-orange; poison says "is poisoned" and tints green. An arcane unmaking is
// neither, and reskinning poison to read neutrally would cost that status its own
// identity everywhere else to buy this one a colour.
//
// The `cursed` fx key was ALREADY in Animations.STATUS_FX (tile 575, violet,
// pulsing) with no status using it — the overlay was built and waiting. Eighth
// time on this port that the machinery was present and only the content missing.

const corrupted = defineStatus({
    name: "Corrupted",
    category: "dot",
    valence: "negative",
    icon: null,
    fx: "cursed",
    duration: 3,
    initialize: function (damage = 3, howManyTurns = 3) {
        this._corruptionDamage = damage
        this._howManyTurns = howManyTurns
        // Items can carry statuses too (a burning item tints); corruption is an
        // actor-only affliction, so an item just takes the tint and no ticking.
        if (this.type === "item") {
            this.tint = 0x9a7bff
            if (this.sprite) {
                this.sprite.tint = this.tint
                this.sprite.tintFill = false
            }
        } else {
            gameLog.log(`${this.name} is unravelling.`)
        }
    },

    // Mirrors burning/poison exactly: the _activated latch means the tick fires
    // once per ROUND even though turn() is called many times within one, and
    // refresh() below clears the latch when the round rolls over.
    turn() {
        if (this.type === "item") return
        if (this._howManyTurns > 0 && !this._corruptionActivated) {
            this._corruptionActivated = true
            this.healthPoints -= this._corruptionDamage
            this._howManyTurns -= 1
            gameLog.log(`${this.name} loses ${this._corruptionDamage} to corruption.`)
        }
        if (this._howManyTurns === 0) {
            this.removeTag(corrupted)
        }
    },

    refresh() {
        this._corruptionActivated = false
    },
})

// Apply OR refresh Corruption with explicit numbers.
//
// THIS HELPER IS NOT OPTIONAL HERE, unlike on the other DoTs where it is a nicety.
// Taggable.addTag dedups by NAME, so a second addTag(corrupted) on an already
// corrupted victim is a silent no-op that does not re-run initialize. The
// Unraveling's residue re-applies this EVERY ROUND to whoever is standing in it,
// so without the refresh path an enemy who walked in on round one would keep the
// original three-round timer and walk out uncorrupted while still standing in the
// zone. Takes the stronger damage and the longer timer, the same way applyPoison
// does.
export function applyCorruption(victim, damage = 3, turns = 3) {
    if (!victim) return
    if (victim._tags?.includes("Corrupted")) {
        victim._corruptionDamage = Math.max(victim._corruptionDamage || 0, damage)
        victim._howManyTurns = Math.max(victim._howManyTurns || 0, turns)
    } else {
        victim.addTag(corrupted, damage, turns)
    }
}

export default corrupted
