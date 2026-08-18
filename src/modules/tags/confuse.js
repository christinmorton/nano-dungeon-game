import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Confuse — the entity staggers to a random adjacent tile and is too addled to
// attack for N turns. This tag tracks duration; the random-stumble behavior is
// applied in archetypes/mindControl.js (read from BaseEnemy.turn()). (A fuller
// "attack a random adjacent target" redirect is still a future refinement.)

const confuse = defineStatus({
    name: "Confuse",
    category: "alteration",
    valence: "negative",
    icon: null,
    duration: 3,
    initialize: function (turns = 3) {
        this._confuseTurns = turns
        gameLog.log(`${this.name} is confused.`)
    },
    refresh: function (baseResult) {
        this._confuseTurns -= 1
        if (this._confuseTurns <= 0) {
            this.removeTag(confuse)
            gameLog.log(`${this.name} regains its senses.`)
        }
        return baseResult
    }
    // TODO: redirect this entity's attacks to a random adjacent target while active.
})

export default confuse
