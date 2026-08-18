import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Acid — corrosive damage-over-time, the DoT Acid Spray applies. The game's
// FIRST stacking status: each re-application adds a stack (up to a cap), ADDING
// to the per-turn damage and refreshing the duration.
//
// IDENTITY vs Poison (differentiated 2026-06-30): Poison is a pure HP bleed.
// Acid is CORROSIVE — alongside the HP tick it MELTS ARMOR, a shred that scales
// with its stacks (statContribution('armor'), the same hook Sunder/Corrosion
// use). So Poison = patient HP drain; Acid = anti-armor burst that also softens
// the target for everything else. (Corrosion stays the Decay tree's deeper,
// HP-free, ever-worsening shred — Acid is the lighter combined version.)
//
// How stacking works here (the pattern to copy for future stacking statuses):
//   - DoT state lives on the ENTITY as fields (Taggable stores counters there),
//     not per-tag — there's only ever one "Acid" entry in entity._tags.
//   - Taggable.addTag DEDUPS by name, so a second addTag(acid) on an already-
//     acid-coated victim is a no-op. Stacking therefore goes through applyAcid()
//     below, which bumps the entity's stack fields directly instead of re-adding.
//   - It ticks in turn() guarded by an `_acidActivated` flag, reset each round
//     in refresh() — the same one-tick-per-round pattern as Burning/Poison/Bleed
//     (the dummy and real combat both drive turn() as the DoT tick point).
//   - Armor shred = `_acidStacks * _acidShred` while the tag is live; it lapses
//     automatically when the tag is removed (its statContribution handler is
//     detached) and cleanup zeroes the fields.

const acid = defineStatus({
    name: "Acid",
    category: "dot",
    valence: "negative",
    icon: null,
    duration: 3,
    initialize: function (damagePerStack = 5, turns = 3, shredPerStack = 1) {
        this._acidDamage = damagePerStack   // running per-turn total — grows per stack
        this._acidTurns = turns
        this._acidStacks = 1
        this._acidShred = shredPerStack     // -armor per stack while corroding
        this._acidActivated = false
        gameLog.log(`${this.name} is splashed with corrosive acid (-${this._acidShred} armor).`)
    },
    turn: function () {
        if (this._acidTurns > 0 && !this._acidActivated) {
            this._acidActivated = true
            this.healthPoints -= this._acidDamage
            const stackNote = this._acidStacks > 1 ? ` (${this._acidStacks}x)` : ""
            gameLog.log(`${this.name} loses ${this._acidDamage} HP to acid${stackNote}.`)
            this._acidTurns -= 1
        }
        if (this._acidTurns <= 0) {
            this.removeTag(acid)
            gameLog.log(`${this.name}'s acid burns out.`)
        }
    },
    refresh: function () {
        this._acidActivated = false   // re-arm the once-per-round tick
    },
    // Corrosive armor melt — scales with stacks, so a deeper coat eats more armor.
    statContribution: function (running, name) {
        if (name === 'armor') return (running || 0) - (this._acidStacks || 0) * (this._acidShred || 0)
        return running
    },
    cleanup: function () {
        this._acidStacks = 0
        this._acidTurns = 0
        this._acidDamage = 0
        this._acidShred = 0
        this._acidActivated = false
    }
    // TODO: with a durability system, also chew the equipped armor's own HP/value.
})

// Apply OR stack Acid on a victim — the only correct way to apply this status
// (addTag alone can't stack; see the header). A fresh victim gets the tag; an
// already-coated one gains another stack (capped at maxStacks), ADDING
// perStackDamage to the per-turn total, deepening the armor melt (shred scales
// with stacks automatically), and ALWAYS refreshes the duration.
// First stacking-status applier in the game — generalize when a second appears.
export function applyAcid(victim, perStackDamage = 5, turns = 3, maxStacks = 3, shredPerStack = 1) {
    if (!victim) return
    if (victim._tags?.includes("Acid")) {
        if ((victim._acidStacks || 1) < maxStacks) {
            victim._acidStacks = (victim._acidStacks || 1) + 1
            victim._acidDamage = (victim._acidDamage || 0) + perStackDamage
        }
        victim._acidTurns = turns   // refresh duration on every re-apply, even at cap
        const shred = (victim._acidStacks || 0) * (victim._acidShred || 0)
        gameLog.log(`${victim.name}'s acid deepens (${victim._acidStacks}x, ${victim._acidDamage}/turn, -${shred} armor).`)
    } else {
        victim.addTag(acid, perStackDamage, turns, shredPerStack)
    }
}

export default acid
