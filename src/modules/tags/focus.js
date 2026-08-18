import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Focus — +attackPower for N turns (Hunter's Focus). The raw-power steroid; the
// attackPower path feeds hero.attack(), so it boosts bow damage while held. Pairs
// with Aim (crit) for a precision + power burst. Same shape as Might.

const focus = defineStatus({
    name: "Focus",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 4,
    initialize: function (turns = 4, bonus = 4) {
        this._focusTurns = turns
        this._focusBonus = bonus
        gameLog.log(`${this.name} focuses (+${bonus} attack).`)
    },
    refresh: function (baseResult) {
        this._focusTurns -= 1
        if (this._focusTurns <= 0) {
            this.removeTag(focus)
            gameLog.log(`${this.name}'s focus fades.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'attackPower') return (running || 0) + (this._focusBonus ?? 0)
        return running
    }
})

export default focus
