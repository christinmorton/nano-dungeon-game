import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Rime's Bite — a freezing damage-over-time (the Ice tree's attrition DoT). The
// deep cold gnaws: slower per-tick than Burning but it lingers. The ice cousin of
// Burning / Blight. Guarded turn() tick + refresh() reset (the Burning convention,
// so it ticks on the training bench too).

const rimesBite = defineStatus({
    name: "Rime's Bite",
    category: "dot",
    valence: "negative",
    icon: null,
    duration: 4,
    initialize: function (damage = 2, howManyTurns = 4) {
        this._rimeBiteDamage = damage
        this._rimeBiteTurns = howManyTurns
        gameLog.log(`${this.name} is gnawed by rime's bite.`)
    },
    turn() {
        if (this._rimeBiteTurns > 0 && !this._rimeBiteActivated) {
            this._rimeBiteActivated = true
            this.healthPoints -= this._rimeBiteDamage
            this._rimeBiteTurns -= 1
            gameLog.log(`${this.name} suffers ${this._rimeBiteDamage} from rime's bite.`)
        }
        if (this._rimeBiteTurns == 0) {
            this.removeTag(rimesBite)
        }
    },
    refresh() {
        this._rimeBiteActivated = false
    }
})

export default rimesBite
