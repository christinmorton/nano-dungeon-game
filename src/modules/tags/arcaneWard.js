import { defineStatus } from "./Status.js"

// Arcane Ward — permanent trait tag behind the Arcane affinity passive of the same
// name: a flat +barrier (magic mitigation) for as long as the passive is held.
// fleetFooted-style: no duration, applied/reverted by the Passive wrapper.
const arcaneWard = defineStatus({
    name: "Arcane Ward",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (bonus = 6) { this._arcaneWard = bonus },
    statContribution: function (running, name) {
        if (name === 'barrier') return (running || 0) + (this._arcaneWard ?? 0)
        return running
    }
})

export default arcaneWard
