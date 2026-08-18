import idle from "./idle.js"
import patrolling from "./patrolling.js"
import scouting from "./scouting.js"
import claiming from "./claiming.js"

// Activity registry — captains pick one activity at a time and the
// captain archetype dispatches via this map every non-engaged tick.
// Activities own out-of-combat squad behavior; once the captain
// engages with the player, the playbook layer takes over and
// activities pause. Add new activities (hunting / scavenging) by
// importing and registering here.

const activities = {
    idle,
    patrolling,
    scouting,
    claiming
}

export default activities
