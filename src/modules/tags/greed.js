import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Greed — defeated enemies drop double gold, but the bearer takes more
// damage while active. STUB: gold rewards are part of the planned shop
// system; the damage modifier needs a victim-side incoming-damage hook.
// Permanent until cleansed; inert marker for now.

const greed = defineStatus({
    name: "Greed",
    category: "shop",
    valence: "mixed",
    icon: null,
    duration: null,
    initialize: function () {
        gameLog.log(`${this.name} is consumed by greed.`)
    }
    // TODO: 2x gold drops (shop system) + increased damage taken while active.
})

export default greed
