import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Corroded — destroys a random consumable when the bearer takes damage.
// STUB: needs an inventory-destroy on a "taking damage" trigger, planned
// alongside the shop / item system. Permanent until cleansed; inert
// marker for now.

const corroded = defineStatus({
    name: "Corroded",
    category: "shop",
    valence: "negative",
    icon: null,
    duration: null,
    initialize: function () {
        gameLog.log(`${this.name}'s pack starts to corrode.`)
    }
    // TODO: destroy a random consumable when damaged (needs inventory + damage trigger).
})

export default corroded
