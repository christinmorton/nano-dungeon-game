import dungeon from "../Dungeon.js"
import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Doom — a lethal countdown. Each refresh decrements the timer; when it
// hits 0 the entity drops to 0 HP and is removed outright, ignoring armor
// and HP totals. Calls dungeon.removeEntity directly, the same reaper
// Combat uses on a killing blow.

const doom = defineStatus({
    name: "Doom",
    category: "progression",
    valence: "negative",
    icon: null,
    duration: 3,
    initialize: function (turns = 3) {
        this._doomTurns = turns
        gameLog.log(`${this.name} is doomed — ${turns} turns to live.`)
    },
    refresh: function (baseResult) {
        this._doomTurns -= 1
        if (this._doomTurns <= 0) {
            gameLog.log(`${this.name}'s doom comes due!`)
            this.healthPoints = 0
            this.removeTag(doom)
            dungeon.removeEntity(this)
        } else {
            gameLog.log(`${this.name}'s doom: ${this._doomTurns} turns left.`)
        }
        return baseResult
    }
})

export default doom
