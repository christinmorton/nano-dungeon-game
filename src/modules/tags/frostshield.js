import { defineStatus } from "./Status.js"

// Frostshield — Frost pool passive trait: a flat +barrier (an icy ward that softens
// magic damage). Permanent; attached/detached by the Passive wrapper.
const frostshield = defineStatus({
    name: "Frostshield",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (bonus = 6) { this._frostshield = bonus },
    statContribution: function (running, name) {
        if (name === 'barrier') return (running || 0) + (this._frostshield ?? 0)
        return running
    }
})

export default frostshield
