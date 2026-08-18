import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Sense — duration marker tag on the hero. No per-entity effects; the
// presence of the tag is queried directly by FogOfWar.syncEntities,
// which bypasses LoS-based enemy visibility while the tag is active.
// Ticks down each refresh; auto-removes at 0. Applied by Elf Sense.

const sense = defineStatus({
    name: "Sense",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 5,
    initialize: function (turns = 5) {
        this._senseTurns = turns
        gameLog.log(`${this.name}'s senses sharpen — every enemy revealed.`)
    },
    refresh: function (baseResult) {
        this._senseTurns -= 1
        if (this._senseTurns <= 0) {
            this.removeTag(sense)
            gameLog.log(`${this.name}'s sense fades.`)
        }
        return baseResult
    }
})

export default sense
