import gameLog from "../GameLog.js"
import { defineStatus, positiveStatusesOn, getStatusTemplate } from "./Status.js"

// Empowered ARCANE — The First Weaver's blessing (§19.6): raw magic mastered, the weaver's
// craft. Demi-god tier (unlocked when arcane is empowered). Three paths read live rank off
// `entity.affinityPaths[key].rank`.

const rankOf = (e, k) => e.affinityPaths?.[k]?.rank || 1

// Overchannel — raw magic power.
export const weave = defineStatus({
    name: "Overchannel (Weave)", category: "buff", valence: "positive", duration: null,
    statContribution: function (running, name) {
        if (name === "magicPower") return (running || 0) + rankOf(this, "weave") * 4
        return running
    },
})
export const weaveReadout = (e, r = 1) => `+${(r || 1) * 4} magic power`

// Unweaving — pierce barrier and dispel a boon on every hit.
export const unweaving = defineStatus({
    name: "Unweaving", category: "buff", valence: "mixed", duration: null,
    armorPen: function (running, damageType) { return (running || 0) + rankOf(this, "unweave") * 3 },
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) {
            const pos = positiveStatusesOn(victim)[0]
            if (pos) {
                const t = getStatusTemplate(pos.name)
                if (t) { victim.removeTag(t); gameLog.log(`${victim.name}'s ${pos.name} is unwoven.`) }
            }
        }
        return ret
    },
})
export const unweaveReadout = (e, r = 1) => `+${(r || 1) * 3} pierce · dispels a boon on hit`

// Warding — a barrier of woven magic that lashes back at attackers.
export const warding = defineStatus({
    name: "Warding", category: "buff", valence: "positive", duration: null,
    statContribution: function (running, name) {
        if (name === "barrier") return (running || 0) + rankOf(this, "ward") * 4
        return running
    },
    onDamaged: function (ret, attacker, dealt) {
        if (attacker?.sprite && attacker !== this && attacker.healthPoints > 0) {
            attacker.healthPoints -= rankOf(this, "ward") * 2
        }
        return ret
    },
})
export const wardReadout = (e, r = 1) => `+${(r || 1) * 4} barrier · ${(r || 1) * 2} backlash when struck`
