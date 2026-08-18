import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"
import weaken from "./weaken.js"
import fear from "./fear.js"

// Dread — Demonic path (§19.6): terror. A demon's presence unmans its foes. Every blow
// Weakens the struck, and has a rank-scaled chance to strike raw Fear into it (flee).
// The control face of the demon — break the enemy's will, not just its body. Rank read
// live off `affinityPaths.dread.rank`.

const FEAR_CHANCE_PER_RANK = 0.2   // 20% / 40% / 60% chance to instill Fear on hit
const rankOf = e => e.affinityPaths?.dread?.rank || 1

const dread = defineStatus({
    name: "Dread",
    category: "buff",
    valence: "positive",
    duration: null,
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) {
            victim.addTag(weaken)
            // Fear varies by index-free chance (Math.random is fine in game code).
            if (Math.random() < rankOf(this) * FEAR_CHANCE_PER_RANK) {
                victim.addTag(fear)
                gameLog.log(`${victim.name} is gripped by dread.`)
            }
        }
        return ret
    },
})

export function dreadReadout(entity, rank = 1) {
    return `Weaken on hit · ${Math.round((rank || 1) * FEAR_CHANCE_PER_RANK * 100)}% to instill Fear`
}

export default dread
