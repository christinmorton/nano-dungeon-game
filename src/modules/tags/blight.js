import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Blight — dark-flavored damage-over-time. Slower per-tick than Bleed but
// runs longer; design framing is "harder to cleanse" (relevant once
// Cleanse can be resisted — no mechanic for that yet, so it cleanses
// normally). Same hands-off death handling as the other DoTs.

const blight = defineStatus({
    name: "Blight",
    category: "dot",
    valence: "negative",
    icon: null,
    duration: 5,
    initialize: function (damage = 1, turns = 5) {
        this._blightDamage = damage
        this._blightTurns = turns
        gameLog.log(`${this.name} is afflicted with blight.`)
    },
    refresh: function (baseResult) {
        if (this._blightTurns > 0) {
            this.healthPoints -= this._blightDamage
            gameLog.log(`${this.name} loses ${this._blightDamage} HP to blight.`)
            this._blightTurns -= 1
            if (this._blightTurns <= 0) {
                this.removeTag(blight)
                gameLog.log(`${this.name}'s blight clears.`)
            }
        }
        return baseResult
    }
})

export default blight
