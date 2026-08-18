import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Corrosion — the Decay tree's signature debuff: a MELTING armor shred. Unlike
// Sunder (a flat -N armor for the duration), corrosion EATS DEEPER each round —
// the reduction grows by 1 per turn up to a cap, so the longer it festers the
// softer the target gets. The DoT-tree's debuff: it doesn't tick HP, it ticks
// ARMOR. Interim stand-in for the true durability/armor-damage system (which
// would also degrade the gear itself); flagged below.
//
// NOTE on naming: distinct from the "Corroded" shop stub (corroded.js), which
// destroys a consumable when hit and waits on the inventory system. This is the
// live combat debuff.

const corrosion = defineStatus({
    name: "Corrosion",
    category: "debuff",
    valence: "negative",
    icon: null,
    duration: 4,
    initialize: function (turns = 4, amount = 2, max = 6) {
        this._corrosionTurns = turns
        this._corrosionAmount = amount
        this._corrosionMax = max
        gameLog.log(`${this.name}'s armor corrodes (-${amount} armor, worsening).`)
    },
    refresh: function (baseResult) {
        // Eat deeper each round (up to the cap), then count down and clear.
        if (this._corrosionAmount < this._corrosionMax) {
            this._corrosionAmount += 1
        }
        this._corrosionTurns -= 1
        if (this._corrosionTurns <= 0) {
            this.removeTag(corrosion)
            gameLog.log(`${this.name}'s corrosion sets and stops spreading.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'armor') return (running || 0) - (this._corrosionAmount ?? 0)
        return running
    }
    // TODO: with a durability system, also chew the equipped armor's own HP/value.
})

// Apply OR deepen Corrosion. addTag dedups by name, so a re-cast on an already-
// corroding target won't re-run initialize; instead bump the running amount (a
// fresh acid splash on top of the melt) and refresh the timer. Mirrors the
// applyAcid stacking-applier shape.
export function applyCorrosion(victim, turns = 4, amount = 2, max = 6) {
    if (!victim) return
    if (victim._tags?.includes("Corrosion")) {
        victim._corrosionAmount = Math.min(max, (victim._corrosionAmount || 0) + amount)
        victim._corrosionMax = max
        victim._corrosionTurns = turns
        gameLog.log(`${victim.name}'s corrosion deepens (-${victim._corrosionAmount} armor).`)
    } else {
        victim.addTag(corrosion, turns, amount, max)
    }
}

export default corrosion
