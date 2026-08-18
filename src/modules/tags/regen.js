import gameLog from "../GameLog.js"
import { spawnHealNumber } from "../Animations.js"
import { defineStatus } from "./Status.js"

// Heal-over-time. Heals N HP each entity refresh() for M turns, then
// auto-removes. Clamped to maxHealthPoints per [[feedback-max-is-canonical-stat]].
// Applied by Dwarf Second Wind; the same tag could be reused for any
// future regen source (e.g., a Regen potion, Cleric prayer).

const regen = defineStatus({
    name: "Regen",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 4,
    initialize: function (amountPerTurn = 2, turns = 4) {
        this._regenAmount = amountPerTurn
        this._regenTurns = turns
        gameLog.log(`${this.name} starts regenerating.`)
    },
    refresh: function (baseResult) {
        if (this._regenTurns > 0) {
            const healed = Math.min(this._regenAmount, this.maxHealthPoints - this.healthPoints)
            if (healed > 0) {
                this.healthPoints += healed
                spawnHealNumber(this, healed)
            }
            this._regenTurns -= 1
            if (this._regenTurns <= 0) {
                this.removeTag(regen)
                gameLog.log(`${this.name}'s regen fades.`)
            }
        }
        return baseResult
    }
})

export default regen
