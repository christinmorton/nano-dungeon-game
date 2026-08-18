import { defineStatus } from "./Status.js"

// Overchannel — permanent trait behind the Arcane Overchannel passive: a flat
// +magicPower (every spell hits harder via rollDamage). Distinct from the affinity's
// statBonus (which grants Magic the stat); this adds raw power on top.
const overchannel = defineStatus({
    name: "Overchannel",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (bonus = 4) { this._overchannel = bonus },
    statContribution: function (running, name) {
        if (name === 'magicPower') return (running || 0) + (this._overchannel ?? 0)
        return running
    }
})

export default overchannel
