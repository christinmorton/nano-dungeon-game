import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Levitate — float off the ground: while held, the wearer FLOATS over ground
// hazards/traps (the on-step hazard trigger is skipped in Hazards.triggerHazardsAt
// when the entity has this tag — wired 2026-06-24, the Wind Levitate ability is
// its applier). The "double knockback distance" half is still a TODO (knockback
// isn't routed through a per-victim distance modifier yet).

const levitate = defineStatus({
    name: "Levitate",
    category: "spatial",
    valence: "positive",
    icon: null,
    duration: 4,
    initialize: function (turns = 4) {
        this._levitateTurns = turns
        gameLog.log(`${this.name} rises off the ground.`)
    },
    refresh: function (baseResult) {
        this._levitateTurns -= 1
        if (this._levitateTurns <= 0) {
            this.removeTag(levitate)
            gameLog.log(`${this.name} settles back down.`)
        }
        return baseResult
    }
    // TODO: ignore floor traps/spikes + double knockback distance (needs trap + knockback hooks).
})

export default levitate
