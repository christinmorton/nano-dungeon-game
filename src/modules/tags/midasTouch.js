import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Midas Touch — the next enemy this entity defeats converts to gold or a
// random utility item instead of a normal drop. STUB: needs a kill hook
// plus the planned shop / loot system. Permanent until consumed; inert
// marker for now.

const midasTouch = defineStatus({
    name: "Midas Touch",
    category: "shop",
    valence: "positive",
    icon: null,
    duration: null,
    initialize: function () {
        gameLog.log(`${this.name}'s touch turns to gold.`)
    }
    // TODO: convert the next defeated enemy to gold/item (needs a kill hook + shop/loot).
})

export default midasTouch
