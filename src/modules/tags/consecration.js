import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"
import smitten from "./smitten.js"

// Consecration — Holy path (§19.6): holy ground. The bearer stands warded by a barrier of
// blessed light, and any foe that strikes them is met with radiant judgment (Smitten).
// The divine host made present — the ward that punishes. Rank scales the barrier; read
// live off `affinityPaths.consecration.rank`.

const BARRIER_PER_RANK = 3
const rankOf = e => e.affinityPaths?.consecration?.rank || 1

const consecration = defineStatus({
    name: "Consecration",
    category: "buff",
    valence: "positive",
    duration: null,
    statContribution: function (running, name) {
        if (name === "barrier") return (running || 0) + rankOf(this) * BARRIER_PER_RANK
        return running
    },
    onDamaged: function (ret, attacker, dealt) {
        if (attacker?.sprite && attacker !== this && attacker.healthPoints > 0) {
            attacker.addTag(smitten)
            gameLog.log(`${attacker.name} is judged for striking consecrated ground.`)
        }
        return ret
    },
})

export function consecrationReadout(entity, rank = 1) {
    return `+${(rank || 1) * BARRIER_PER_RANK} barrier · strikers are Smitten`
}

export default consecration
