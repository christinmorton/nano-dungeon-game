import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Exhausted — blocks the Use Item verb for the rest of the floor. STUB:
// needs an item-use gate in HeroController (no hook to veto item use
// today). Permanent until floor change (no auto-expire here); inert
// marker for now.

const exhausted = defineStatus({
    name: "Exhausted",
    category: "progression",
    valence: "negative",
    icon: null,
    duration: null,
    initialize: function () {
        gameLog.log(`${this.name} is too exhausted to use items.`)
    }
    // TODO: veto the Use Item verb in HeroController while present; clear on floor change.
})

export default exhausted
