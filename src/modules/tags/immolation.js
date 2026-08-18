import gameLog from "../GameLog.js"
import burning from "./burning.js"
import { defineStatus } from "./Status.js"

// Immolation — Fire pool passive trait: a melee attacker that strikes the bearer
// CATCHES FIRE (Burning) — the fire cousin of Thorns. Fires on the onDamaged hook
// (bearer survived the hit); addTag is idempotent so it won't re-stack mid-burn.
const immolation = defineStatus({
    name: "Immolation",
    category: "buff",
    valence: "mixed",
    duration: null,
    onDamaged: function (ret, attacker, dealt) {
        if (attacker?.sprite && attacker !== this && attacker.healthPoints > 0) {
            attacker.addTag(burning)
            gameLog.log(`${attacker.name} is set alight striking ${this.name}.`)
        }
        return ret
    }
})

export default immolation
