import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Fear — forces the entity to flee from the player for N turns. This tag tracks
// duration; the forced flight is applied in archetypes/mindControl.js (read from
// BaseEnemy.turn(), the same slot as Stun/Rooted/flee).

const fear = defineStatus({
    name: "Fear",
    category: "alteration",
    valence: "negative",
    icon: null,
    duration: 3,
    initialize: function (turns = 3) {
        this._fearTurns = turns
        gameLog.log(`${this.name} is gripped by fear.`)
    },
    refresh: function (baseResult) {
        this._fearTurns -= 1
        if (this._fearTurns <= 0) {
            this.removeTag(fear)
            gameLog.log(`${this.name} steels its nerve.`)
        }
        return baseResult
    }
    // The forced flight itself lives in archetypes/mindControl.js (fearTurn),
    // dispatched from BaseEnemy.turn() — see this file's header.
})

export default fear
