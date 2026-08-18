import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Bleed — physical damage-over-time. Subtracts N HP each refresh for M
// turns, then auto-removes. Same hands-off death handling as Burning: it
// only lowers healthPoints; the turn loop / next death check reaps a
// corpse. Bleed scales with the applier's attackPower in the design;
// stored per-apply so a stronger source can dial it up.

const bleed = defineStatus({
    name: "Bleed",
    category: "dot",
    valence: "negative",
    icon: null,
    fx: "bleed",
    duration: 4,
    initialize: function (damage = 2, turns = 4) {
        this._bleedDamage = damage
        this._bleedTurns = turns
        gameLog.log(`${this.name} starts bleeding.`)
    },
    refresh: function (baseResult) {
        if (this._bleedTurns > 0) {
            this.healthPoints -= this._bleedDamage
            gameLog.log(`${this.name} loses ${this._bleedDamage} HP to bleeding.`)
            this._bleedTurns -= 1
            if (this._bleedTurns <= 0) {
                this.removeTag(bleed)
                gameLog.log(`${this.name}'s bleeding stops.`)
            }
        }
        return baseResult
    }
})

export default bleed
