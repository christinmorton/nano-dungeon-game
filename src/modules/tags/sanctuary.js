import { defineStatus } from "./Status.js"

// Sanctuary — Holy path (§19.6): the divine ward, deepening Aegis. The bearer takes less
// damage from all sources AND is knit back together each round — the angel's protection
// made a fortress. Rank scales both; read live off `affinityPaths.sanctuary.rank`.

const DR_PER_RANK = 0.05    // -5% damage taken per rank (capped)
const HEAL_PER_RANK = 2
const rankOf = e => e.affinityPaths?.sanctuary?.rank || 1

const sanctuary = defineStatus({
    name: "Sanctuary",
    category: "buff",
    valence: "positive",
    duration: null,
    damageTakenMult: function (mult) {
        return (mult ?? 1) * (1 - Math.min(0.5, rankOf(this) * DR_PER_RANK))
    },
    refresh: function (baseResult) {
        const heal = rankOf(this) * HEAL_PER_RANK
        if (this.healthPoints > 0) {
            this.healthPoints = Math.min(this.maxHealthPoints ?? this.healthPoints, this.healthPoints + heal)
        }
        return baseResult
    },
})

export function sanctuaryReadout(entity, rank = 1) {
    return `-${Math.round((rank || 1) * DR_PER_RANK * 100)}% damage taken · regen ${(rank || 1) * HEAL_PER_RANK}/turn`
}

export default sanctuary
