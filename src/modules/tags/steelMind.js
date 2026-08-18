import { defineStatus } from "./Status.js"

// Permanent trait tag behind the Steel Mind passive: +barrier (MAGIC resist) via
// the stat reducer. The magic cousin of Toughness (which is +armor). No duration
// — attached/detached by the Passive wrapper. Valence 'mixed' so it isn't a
// Dispel-able buff (it's a trait, not a temporary blessing).

const STEEL_MIND_BARRIER = 5

const steelMind = defineStatus({
    name: "Steel Mind",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    statContribution: function (running, name) {
        if (name === 'barrier') return (running || 0) + STEEL_MIND_BARRIER
        return running
    }
})

export default steelMind
