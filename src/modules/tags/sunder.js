import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Sunder — -N armor for M turns, so physical hits land harder. Mirrors
// Weaken on the defensive side via statContribution('armor'), which feeds
// the physical mitigation path in Combat. Auto-removes at duration end.

const sunder = defineStatus({
    name: "Sunder",
    category: "debuff",
    valence: "negative",
    icon: null,
    duration: 3,
    initialize: function (turns = 3, amount = 2) {
        this._sunderTurns = turns
        this._sunderAmount = amount
        gameLog.log(`${this.name}'s armor is sundered (-${amount} armor).`)
    },
    refresh: function (baseResult) {
        this._sunderTurns -= 1
        if (this._sunderTurns <= 0) {
            this.removeTag(sunder)
            gameLog.log(`${this.name}'s armor recovers.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'armor') return (running || 0) - (this._sunderAmount ?? 0)
        return running
    }
})

export default sunder
