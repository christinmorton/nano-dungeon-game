import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Haste — grants extra movement points each turn for N turns. The inverse
// of Slow: runs in refresh (after MP refill) so the entity ends the
// boundary with more to spend. Auto-removes at duration end.

const haste = defineStatus({
    name: "Haste",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 3,
    initialize: function (turns = 3, bonus = 2) {
        this._hasteTurns = turns
        this._hasteBonus = bonus
        gameLog.log(`${this.name} speeds up.`)
    },
    refresh: function (baseResult) {
        this.movementPoints += this._hasteBonus
        this._hasteTurns -= 1
        if (this._hasteTurns <= 0) {
            this.removeTag(haste)
            gameLog.log(`${this.name} slows back to normal.`)
        }
        return baseResult
    }
})

export default haste
