import { defineStatus } from "./Status.js"

// Permanent trait tag behind the Keen Edge passive: +attackPower via the
// stat reducer. No duration — managed by the Passive wrapper. Valence
// 'mixed' so it isn't Dispel-able (a trait, not a temporary buff).

const KEEN_EDGE_BONUS = 2

const keenEdge = defineStatus({
    name: "Keen Edge",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    statContribution: function (running, name) {
        if (name === 'attackPower') return (running || 0) + KEEN_EDGE_BONUS
        return running
    }
})

export default keenEdge
