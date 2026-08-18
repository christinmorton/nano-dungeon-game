import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Disarmed — a martial debuff that cripples offense: -N attackPower for M turns
// (a weapon knocked aside). Same shape as Weaken, but its own name/log so a Disarm
// reads distinctly, with a heavier default. Applied by Disarm.
const disarmed = defineStatus({
    name: "Disarmed",
    category: "debuff",
    valence: "negative",
    icon: null,
    duration: 3,
    initialize: function (turns = 3, amount = 8) {
        this._disarmedTurns = turns
        this._disarmedAmount = amount
        gameLog.log(`${this.name} is disarmed (-${amount} attack)!`)
    },
    refresh: function (baseResult) {
        this._disarmedTurns -= 1
        if (this._disarmedTurns <= 0) {
            this.removeTag(disarmed)
            gameLog.log(`${this.name} recovers their weapon.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'attackPower') return (running || 0) - (this._disarmedAmount ?? 0)
        return running
    }
})

export default disarmed
