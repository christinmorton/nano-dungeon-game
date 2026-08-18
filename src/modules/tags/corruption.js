import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Corruption — VOID corruption: a stacking dark damage-over-time, the signature
// rider of the Void tree's Entropy Beam (and a candidate for other void spells).
// The void counterpart to Decay's Acid: each application adds a stack (up to a
// cap) that ADDS to the per-turn unravelling and refreshes the duration. Where
// Decay's Corrosion melts ARMOR, void Corruption eats the body itself — raw
// entropy. (Distinct from Decay's "Corrosion" and the shop "Corroded" stub.)
//
// Stacking works exactly like acid (the proven template): one "Corruption" tag in
// _tags, the running per-turn total lives on the entity, applyCorruption() bumps
// it (addTag dedups by name, so a re-add is a no-op). Ticks in turn() guarded by
// _corruptionActivated, reset in refresh() — one tick per round.

const corruption = defineStatus({
    name: "Corruption",
    category: "dot",
    valence: "negative",
    icon: null,
    fx: "cursed",
    duration: 4,
    initialize: function (damagePerStack = 4, turns = 4) {
        this._corruptionDamage = damagePerStack   // running per-turn total — grows per stack
        this._corruptionTurns = turns
        this._corruptionStacks = 1
        this._corruptionActivated = false
        gameLog.log(`${this.name} is wracked with void corruption.`)
    },
    turn: function () {
        if (this._corruptionTurns > 0 && !this._corruptionActivated) {
            this._corruptionActivated = true
            this.healthPoints -= this._corruptionDamage
            const stackNote = this._corruptionStacks > 1 ? ` (${this._corruptionStacks}x)` : ""
            gameLog.log(`${this.name} loses ${this._corruptionDamage} HP to corruption${stackNote}.`)
            this._corruptionTurns -= 1
        }
        if (this._corruptionTurns <= 0) {
            this.removeTag(corruption)
            gameLog.log(`${this.name}'s corruption burns out.`)
        }
    },
    refresh: function () {
        this._corruptionActivated = false   // re-arm the once-per-round tick
    },
    cleanup: function () {
        this._corruptionStacks = 0
        this._corruptionTurns = 0
        this._corruptionDamage = 0
        this._corruptionActivated = false
    }
})

// Apply OR stack Corruption on a victim — the only correct way to apply it
// (addTag alone can't stack; mirrors applyAcid). A fresh victim gets the tag; an
// already-corrupted one gains a stack (capped), ADDING perStackDamage to the
// per-turn total, and ALWAYS refreshes the duration.
export function applyCorruption(victim, perStackDamage = 4, turns = 4, maxStacks = 5) {
    if (!victim) return
    if (victim._tags?.includes("Corruption")) {
        if ((victim._corruptionStacks || 1) < maxStacks) {
            victim._corruptionStacks = (victim._corruptionStacks || 1) + 1
            victim._corruptionDamage = (victim._corruptionDamage || 0) + perStackDamage
        }
        victim._corruptionTurns = turns   // refresh duration on every re-apply, even at cap
        gameLog.log(`${victim.name}'s corruption deepens (${victim._corruptionStacks}x, ${victim._corruptionDamage}/turn).`)
    } else {
        victim.addTag(corruption, perStackDamage, turns)
    }
}

export default corruption
