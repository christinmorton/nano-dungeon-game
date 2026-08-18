import gameLog from "../GameLog.js"
import { resolveDamage } from "../abilities/universals.js"
import { defineStatus } from "./Status.js"

// Thorns — a triggered passive: reflect a fraction of every melee hit back at the
// attacker (the onDamaged hook, fired from Combat.attack when the bearer survives a
// hit). An ALWAYS-ON retaliation that deliberately does NOT use the Counter tag, so
// it never collides with the active Counterstroke / Reflect (which own the single
// Counter tag — the old reason this was "blocked"). Reflects via resolveDamage,
// which does NOT re-fire onDamaged, so there's no retaliation loop. Permanent.
const THORNS_FRACTION = 0.3

const thorns = defineStatus({
    name: "Thorns",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    onDamaged: function (ret, attacker, dealt) {
        if (attacker?.sprite && attacker !== this) {
            const reflected = Math.max(1, Math.round(dealt * THORNS_FRACTION))
            resolveDamage(attacker, reflected, "physical")
            gameLog.log(`${this.name}'s thorns bite ${attacker.name} for ${reflected}.`)
        }
        return ret
    }
})

export default thorns
