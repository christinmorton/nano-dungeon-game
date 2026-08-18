import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Volatile — the entity explodes on death, damaging everything nearby
// (allies and enemies alike). STUB: Taggable fires no hook on
// removeEntity, so there is no death signal to trigger from, and no AOE
// helper exists. Inert marker until a death hook + AOE land.

const volatile = defineStatus({
    name: "Volatile",
    category: "shop",
    valence: "negative",
    icon: null,
    duration: null,
    initialize: function () {
        gameLog.log(`${this.name} becomes volatile.`)
    }
    // TODO: on death, deal AOE damage to adjacent entities (needs a death hook + AOE).
})

export default volatile
