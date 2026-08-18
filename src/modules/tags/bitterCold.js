import { defineStatus } from "./Status.js"

// Bitter Cold — Frost pool passive trait: the bearer deals MORE damage to Slowed
// targets. The Frost affinity's rider slows everything it hits, so this snowballs.
// Wraps outgoingDamageMult (attacker-side, passed the victim). Permanent.
const bitterCold = defineStatus({
    name: "Bitter Cold",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (factor = 1.25) { this._bitterCold = factor },
    outgoingDamageMult: function (running, victim) {
        const m = running ?? 1
        if (victim?._tags?.includes?.("Slow")) return m * (this._bitterCold ?? 1)
        return m
    }
})

export default bitterCold
