import { defineStatus } from "./Status.js"
import acid from "./acid.js"
import weaken from "./weaken.js"
import frailty from "./frailty.js"
import blight from "./blight.js"

// Empowered ACID — Grey Famine's blessing (§19.6): slow ruin, corrosion, the wither of
// famine. Demi-god tier. Three paths read live rank off `entity.affinityPaths[key].rank`.

const rankOf = (e, k) => e.affinityPaths?.[k]?.rank || 1

// Corrode — dissolve defenses and coat every hit in eating acid.
export const corrode = defineStatus({
    name: "Corrode", category: "buff", valence: "positive", duration: null,
    armorPen: function (running, damageType) { return (running || 0) + rankOf(this, "corrode") * 3 },
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) victim.addTag(acid)
        return ret
    },
})
export const corrodeReadout = (e, r = 1) => `+${(r || 1) * 3} pierce · Acid on hit`

// Famine — the wither of starvation; the struck grow Weak and Frail.
export const famine = defineStatus({
    name: "Famine", category: "buff", valence: "positive", duration: null,
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) {
            victim.addTag(weaken)
            victim.addTag(frailty)
        }
        return ret
    },
})
export const famineReadout = (e, r = 1) => `Weaken + Frailty on hit`

// Rot — spreading decay; every strike seeds a withering Blight.
export const rot = defineStatus({
    name: "Rot", category: "buff", valence: "positive", duration: null,
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) victim.addTag(blight)
        return ret
    },
})
export const rotReadout = (e, r = 1) => `Blight (decay DoT) on hit`
