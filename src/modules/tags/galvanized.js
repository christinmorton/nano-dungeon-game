import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Galvanized — lightning reflexes: a short buff that raises BOTH `dodge` and
// `critChance` for N turns (an offense/defense combo, vs the single-stat buffs).
// The Storm tree's self-empower — sharpen to a hair-trigger before a burst.
// dodge is points (~+3%/pt via Combat), critChance is a fraction (+0.15 = +15%).

const galvanized = defineStatus({
    name: "Galvanized",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 3,
    initialize: function (turns = 3, dodge = 6, crit = 0.15) {
        this._galvTurns = turns
        this._galvDodge = dodge
        this._galvCrit = crit
        gameLog.log(`${this.name} is galvanized (+${dodge} dodge, +${Math.round(crit * 100)}% crit).`)
    },
    refresh: function (baseResult) {
        this._galvTurns -= 1
        if (this._galvTurns <= 0) {
            this.removeTag(galvanized)
            gameLog.log(`${this.name}'s charge dissipates.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'dodge') return (running || 0) + (this._galvDodge ?? 0)
        if (name === 'critChance') return (running || 0) + (this._galvCrit ?? 0)
        return running
    }
})

export default galvanized
