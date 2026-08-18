import gameLog from "../GameLog.js"
import shocked from "./shocked.js"
import { defineStatus } from "./Status.js"

// Static Field — Lightning pool passive trait: a melee attacker that strikes the bearer
// is SHOCKED (the lightning cousin of Immolation/Rimeguard). Fires on onDamaged (bearer
// survived); addTag is idempotent so it won't re-arm an active Shock.
const staticField = defineStatus({
    name: "Static Field",
    category: "buff",
    valence: "mixed",
    duration: null,
    onDamaged: function (ret, attacker, dealt) {
        if (attacker?.sprite && attacker !== this && attacker.healthPoints > 0) {
            attacker.addTag(shocked)
            gameLog.log(`${attacker.name} is jolted striking ${this.name}.`)
        }
        return ret
    }
})

export default staticField
