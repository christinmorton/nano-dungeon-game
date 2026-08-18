import { defineStatus } from "./Status.js"

// Etch — Acid pool passive trait: +damage to targets afflicted with Acid (the Acid
// affinity's rider coats everything it hits). Wraps outgoingDamageMult. Permanent.
const etch = defineStatus({
    name: "Etch",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (factor = 1.25) { this._etch = factor },
    outgoingDamageMult: function (running, victim) {
        const m = running ?? 1
        if (victim?._tags?.includes?.("Acid")) return m * (this._etch ?? 1)
        return m
    }
})

export default etch
