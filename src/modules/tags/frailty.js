import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Frailty — equipment takes extra durability damage from hits. STUB: no
// durability system exists yet, so there is nothing to accelerate.
// Duration handling below is real; the durability effect is a TODO.

const frailty = defineStatus({
    name: "Frailty",
    category: "progression",
    valence: "negative",
    icon: null,
    duration: 3,
    initialize: function (turns = 3) {
        this._frailtyTurns = turns
        gameLog.log(`${this.name}'s gear grows brittle.`)
    },
    refresh: function (baseResult) {
        this._frailtyTurns -= 1
        if (this._frailtyTurns <= 0) {
            this.removeTag(frailty)
            gameLog.log(`${this.name}'s gear holds firm again.`)
        }
        return baseResult
    }
    // TODO: increase equipment durability loss per hit (needs a durability system).
})

export default frailty
