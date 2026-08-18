import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Cleric's low-HP regen. Attached at hero construction via the cleric
// profile rather than baked into a subclass — the hero side is one
// generic class now, identity comes from profile + tags. Heal amount
// is unchanged from when this lived in Cleric.refresh: +1 HP per round
// while under 25% of max. Threshold scales with max so the trigger
// stays meaningful as HP totals shift.
//
// Will likely be reworked when the Cleric redesign (issue #45) lands.

const clericRegen = defineStatus({
    name: "Cleric Regen",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: null,
    initialize: function () {},
    refresh: function (baseResult) {
        if (this.healthPoints < this.maxHealthPoints / 4) {
            this.healthPoints += 1
            gameLog.log(`${this.name} heals 1 hp`)
        }
        return baseResult
    }
})

export default clericRegen
