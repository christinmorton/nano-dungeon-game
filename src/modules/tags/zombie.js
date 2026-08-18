import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Zombie — incoming healing is inverted into damage. STUB: healing has no
// single chokepoint to intercept — regen adds healthPoints directly and
// the heal() universal is a separate path — so this needs a unified heal
// hook. Permanent until cleansed (no auto-expire); inert marker for now.

const zombie = defineStatus({
    name: "Zombie",
    category: "alteration",
    valence: "negative",
    icon: null,
    duration: null,
    initialize: function () {
        gameLog.log(`${this.name} is afflicted — healing now harms.`)
    }
    // TODO: intercept heals and convert them to damage (needs a unified heal hook).
})

export default zombie
