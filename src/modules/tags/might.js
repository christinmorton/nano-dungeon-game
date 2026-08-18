import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Might — +N to attackPower for M turns. Applied by Cleric Bless.
// Same shape as bulwark (duration + statContribution + auto-remove).
// Bonus value is stored on the entity so future Might variants (a
// stronger Greater Bless, a weaker self-cast) can dial it per apply.

const might = defineStatus({
    name: "Might",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 3,
    initialize: function (turns = 3, bonus = 2) {
        this._mightTurns = turns
        this._mightBonus = bonus
        gameLog.log(`${this.name} gains Might (+${bonus} attack).`)
    },
    refresh: function (baseResult) {
        this._mightTurns -= 1
        if (this._mightTurns <= 0) {
            this.removeTag(might)
            gameLog.log(`${this.name}'s Might fades.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'attackPower') return (running || 0) + (this._mightBonus ?? 0)
        return running
    }
})

export default might
