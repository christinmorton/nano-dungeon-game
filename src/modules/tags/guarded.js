import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Guarded — a temporary all-round damage-reduction stance: +N to BOTH the armor
// (physical) and barrier (magic) derived stats for M turns. The flat, self-applied
// general defense behind Brace — distinct from Bulwark (block) and Spell Ward
// (magic only). Flat bonus set by the applier (not stat-scaled).
const guarded = defineStatus({
    name: "Guarded",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 3,
    initialize: function (turns = 3, bonus = 6) {
        this._guardedTurns = turns
        this._guardedBonus = bonus
        gameLog.log(`${this.name} braces (+${bonus} armor & magic resist).`)
    },
    refresh: function (baseResult) {
        this._guardedTurns -= 1
        if (this._guardedTurns <= 0) {
            this.removeTag(guarded)
            gameLog.log(`${this.name} relaxes their guard.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'armor' || name === 'barrier') return (running || 0) + (this._guardedBonus ?? 0)
        return running
    }
})

export default guarded
