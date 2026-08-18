import gameLog from "../GameLog.js"
import acid from "./acid.js"
import { defineStatus } from "./Status.js"

// Caustic Skin — Acid pool passive trait: a melee attacker that strikes the bearer is
// coated in ACID (the acid cousin of Immolation/Rimeguard). Fires on onDamaged (bearer
// survived). addTag applies one Acid stack; idempotent while it's active.
const causticSkin = defineStatus({
    name: "Caustic Skin",
    category: "buff",
    valence: "mixed",
    duration: null,
    onDamaged: function (ret, attacker, dealt) {
        if (attacker?.sprite && attacker !== this && attacker.healthPoints > 0) {
            attacker.addTag(acid)
            gameLog.log(`${attacker.name} is splashed with acid striking ${this.name}.`)
        }
        return ret
    }
})

export default causticSkin
