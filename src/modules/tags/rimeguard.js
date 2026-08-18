import gameLog from "../GameLog.js"
import slow from "./slow.js"
import { defineStatus } from "./Status.js"

// Rimeguard — Frost pool passive trait: a melee attacker that strikes the bearer is
// SLOWED — the frost cousin of Immolation/Thorns. Fires on onDamaged (bearer survived
// the hit); addTag is idempotent so it won't re-stack an active Slow.
const rimeguard = defineStatus({
    name: "Rimeguard",
    category: "buff",
    valence: "mixed",
    duration: null,
    onDamaged: function (ret, attacker, dealt) {
        if (attacker?.sprite && attacker !== this && attacker.healthPoints > 0) {
            attacker.addTag(slow)
            gameLog.log(`${attacker.name} is chilled striking ${this.name}.`)
        }
        return ret
    }
})

export default rimeguard
