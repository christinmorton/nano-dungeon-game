import { defineStatus } from "./Status.js"

// Overload — Lightning pool passive trait: +damage to Shocked targets (the Lightning
// affinity's rider shocks what it hits). Wraps outgoingDamageMult. Permanent.
const overload = defineStatus({
    name: "Overload",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (factor = 1.25) { this._overload = factor },
    outgoingDamageMult: function (running, victim) {
        const m = running ?? 1
        if (victim?._tags?.includes?.("Shocked")) return m * (this._overload ?? 1)
        return m
    }
})

export default overload
