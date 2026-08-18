import gameLog from "../GameLog.js"
import { heal } from "../abilities/universals.js"
import { defineStatus } from "./Status.js"

// Bloodthirst — a triggered passive: heal a flat amount each time the bearer lands
// a KILL (the onKill hook, fired from Combat.attack's death path). The martial
// sustain passive — a bruiser tops itself off by cutting enemies down. Weapon
// kills only for now (ability-side kills don't thread an attacker). Permanent;
// valence 'mixed' so it isn't a dispellable buff.
const BLOODTHIRST_HEAL = 6

const bloodthirst = defineStatus({
    name: "Bloodthirst",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    onKill: function (ret, victim) {
        const healed = heal(this, BLOODTHIRST_HEAL)
        if (healed > 0) gameLog.log(`${this.name} drinks in the kill (+${healed} HP).`)
        return ret
    }
})

export default bloodthirst
