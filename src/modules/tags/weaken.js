import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Weaken — -N attackPower for M turns. The inverse of Might; same
// statContribution shape. Auto-removes at duration end.

const weaken = defineStatus({
    name: "Weaken",
    category: "debuff",
    valence: "negative",
    icon: null,
    duration: 3,
    initialize: function (turns = 3, amount = 2) {
        this._weakenTurns = turns
        this._weakenAmount = amount
        gameLog.log(`${this.name} is weakened (-${amount} attack).`)
    },
    refresh: function (baseResult) {
        this._weakenTurns -= 1
        if (this._weakenTurns <= 0) {
            this.removeTag(weaken)
            gameLog.log(`${this.name}'s weakness fades.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'attackPower') return (running || 0) - (this._weakenAmount ?? 0)
        return running
    }
})

export default weaken
