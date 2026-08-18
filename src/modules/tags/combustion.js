import { defineStatus } from "./Status.js"

// Combustion — Fire pool passive trait: the bearer deals MORE damage to targets that
// are already Burning. The Fire affinity's rider burns everything it hits, so this
// snowballs. Wraps outgoingDamageMult (attacker-side, passed the victim). Permanent.
const combustion = defineStatus({
    name: "Combustion",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (factor = 1.25) { this._combustion = factor },
    outgoingDamageMult: function (running, victim) {
        const m = running ?? 1
        if (victim?._tags?.includes?.("Burning")) return m * (this._combustion ?? 1)
        return m
    }
})

export default combustion
