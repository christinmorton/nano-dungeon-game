import blitz from "./blitz.js"
import formation from "./formation.js"
import freeform from "./freeform.js"

// Playbook registry — captains pick one playbook at spawn and the
// captain archetype dispatches via this map every engaged tick.
// Each playbook owns its own cadence (cooldown, phase timers) and
// command vocabulary. Add new playbooks by importing and registering
// here, plus a matching tag in modules/tags that sets captain.playbook.

const playbooks = {
    blitz,
    formation,
    freeform
}

export default playbooks
