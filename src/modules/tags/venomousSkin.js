import gameLog from "../GameLog.js"
import poison from "./poison.js"
import { defineStatus } from "./Status.js"

// Venomous Skin — Poison pool passive trait: a melee attacker that strikes the bearer
// is POISONED (the poison cousin of Immolation/Rimeguard). Fires on onDamaged (bearer
// survived); addTag is idempotent so it won't re-stack an active Poison.
const venomousSkin = defineStatus({
    name: "Venomous Skin",
    category: "buff",
    valence: "mixed",
    duration: null,
    onDamaged: function (ret, attacker, dealt) {
        if (attacker?.sprite && attacker !== this && attacker.healthPoints > 0) {
            attacker.addTag(poison)
            gameLog.log(`${attacker.name} is envenomed striking ${this.name}.`)
        }
        return ret
    }
})

export default venomousSkin
