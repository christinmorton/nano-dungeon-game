import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Spirit Surge — quickening spirits grant extra movement AND action points each
// turn for N turns. Like Haste (movement only), but also tops up action points:
// the shaman's tempo burst. Runs in refresh (after the normal MP/AP refill) so the
// entity ends the turn boundary with more to spend. Auto-removes at duration end.

const surge = defineStatus({
    name: "Surge",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 3,
    initialize: function (turns = 3, mpBonus = 2, apBonus = 1) {
        this._surgeTurns = turns
        this._surgeMp = mpBonus
        this._surgeAp = apBonus
        gameLog.log(`${this.name} surges with quickening spirits.`)
    },
    refresh: function (baseResult) {
        this.movementPoints += this._surgeMp
        this.actionPoints += this._surgeAp
        this._surgeTurns -= 1
        if (this._surgeTurns <= 0) {
            this.removeTag(surge)
            gameLog.log(`${this.name}'s surge fades.`)
        }
        return baseResult
    }
})

export default surge
