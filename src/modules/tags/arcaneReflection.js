import gameLog from "../GameLog.js"
import { resolveDamage } from "../abilities/universals.js"
import { defineStatus } from "./Status.js"

// Arcane Reflection — permanent trait behind the passive: when the bearer SURVIVES a
// hit (the onDamaged hook from Combat), a flash of arcane backlash deals flat MAGIC
// damage to the attacker. The arcane cousin of Thorns. Reflects via resolveDamage
// with NO threaded attacker, so it doesn't re-fire onDamaged (no retaliation loop).
const arcaneReflection = defineStatus({
    name: "Arcane Reflection",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (amount = 3) { this._reflectAmt = amount },
    onDamaged: function (ret, attacker, dealt) {
        if (attacker?.sprite && attacker !== this) {
            resolveDamage(attacker, this._reflectAmt ?? 3, "magic")
            gameLog.log(`${this.name}'s arcane wards lash back at ${attacker.name}.`)
        }
        return ret
    }
})

export default arcaneReflection
