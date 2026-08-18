import { defineStatus } from "./Status.js"

// The Unmaking — Void path (§19.6), the "entropy that dissolves the made." Deepens the
// Void's signature negation: the bearer's damage ignores ever more of the target's
// protection — BOTH armor and barrier — scaling with the path's rank, layered ON TOP of
// Oblivion's base pen. Nothing they've built holds against the end. Rank read live off
// `entity.affinityPaths.unmaking.rank`, so deepening just raises the pierce.

const PEN_PER_RANK = 4
function rankOf(entity) { return entity.affinityPaths?.unmaking?.rank || 1 }

const theUnmaking = defineStatus({
    name: "The Unmaking",
    category: "buff",
    valence: "mixed",
    duration: null,
    armorPen: function (running, damageType) {
        return (running || 0) + rankOf(this) * PEN_PER_RANK
    },
})

export function unmakingReadout(entity, rank = 1) {
    return `+${(rank || 1) * PEN_PER_RANK} armor/barrier pierce (all damage)`
}

export default theUnmaking
