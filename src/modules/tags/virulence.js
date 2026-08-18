import { defineStatus } from "./Status.js"

// Virulence — Poison pool passive trait: +damage to Poisoned targets (the Poison
// affinity's rider poisons everything it hits). Wraps outgoingDamageMult. Permanent.
const virulence = defineStatus({
    name: "Virulence",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (factor = 1.25) { this._virulence = factor },
    outgoingDamageMult: function (running, victim) {
        const m = running ?? 1
        if (victim?._tags?.includes?.("Poison")) return m * (this._virulence ?? 1)
        return m
    }
})

export default virulence
