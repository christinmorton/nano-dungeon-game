import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// The Mending — Light path (§19.6): restoration, the Light's mercy. Each round the bearer
// regenerates AND mends its living party — the warmth that keeps the made world whole.
// Deepens Radiance's self-regen into a group sustain. Rank scales the heal; read live off
// `affinityPaths.mending.rank`. Runs in the hero's per-round refresh (after points refill).

const HEAL_PER_RANK = 3
const rankOf = e => e.affinityPaths?.mending?.rank || 1

const mending = defineStatus({
    name: "The Mending",
    category: "buff",
    valence: "positive",
    duration: null,
    refresh: function (baseResult) {
        const heal = rankOf(this) * HEAL_PER_RANK
        const mend = (unit) => {
            if (unit && unit.healthPoints > 0) {
                unit.healthPoints = Math.min(unit.maxHealthPoints ?? unit.healthPoints, unit.healthPoints + heal)
            }
        }
        mend(this)
        for (const ally of this.party || []) mend(ally)
        return baseResult
    },
})

export function mendingReadout(entity, rank = 1) {
    return `regen ${(rank || 1) * HEAL_PER_RANK}/turn · mends the whole party`
}

export default mending
