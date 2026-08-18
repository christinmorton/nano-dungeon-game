import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// the Veil — the Seraphic "mystery" path (§19). A seraph's nature and allegiance are
// HIDDEN, so it is hard to strike (evasion), and a blow that DOES land is answered by
// a concealed radiance the attacker never saw coming (unblockable backlash). This is
// veiled and CONSISTENT — the effect is real every time, the enemy just can't
// anticipate it — NOT random caprice. Rank (read live off the bearer) scales both the
// evasion and the backlash, so DEEPENING just bumps `affinityPaths.veil.rank`.

const DODGE_PER_RANK = 3        // + dodge stat per rank (dodgeChance = dodge * 0.03, capped)
const BACKLASH_PER_RANK = 3     // unblockable radiance dealt to a striker per rank

function rankOf(entity) { return entity.affinityPaths?.veil?.rank || 1 }

const veil = defineStatus({
    name: "the Veil",
    category: "buff",
    valence: "positive",
    duration: null,
    // Evasion — the veiled seraph is harder to pin down.
    statContribution: function (running, name) {
        if (name === "dodge") return (running || 0) + rankOf(this) * DODGE_PER_RANK
        return running
    },
    // The hidden answer — a landed blow triggers a concealed radiance on the striker.
    onDamaged: function (ret, attacker, dealt) {
        if (attacker?.sprite && attacker !== this && attacker.healthPoints > 0) {
            const backlash = rankOf(this) * BACKLASH_PER_RANK
            attacker.healthPoints -= backlash   // unblockable — the mystery reveals itself
            gameLog.log(`A hidden radiance answers ${attacker.name} for ${backlash}.`)
        }
        return ret
    },
})

// Live state for the Skillbook path readout — current evasion + backlash by rank.
export function veilReadout(entity, rank = 1) {
    const r = rank || 1
    return `+${r * DODGE_PER_RANK} dodge · ${r * BACKLASH_PER_RANK} backlash when struck`
}

export default veil
