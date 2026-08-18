import { defineStatus } from "./Status.js"
import slow from "./slow.js"

// Empowered WIND — The Hollow Swarm's blessing (§19.6): the endless storm, the devouring
// swarm. Demi-god tier. Three paths read live rank off `entity.affinityPaths[key].rank`.

const rankOf = (e, k) => e.affinityPaths?.[k]?.rank || 1

// Gale — ride the wind; near-impossible to pin down.
export const gale = defineStatus({
    name: "Gale", category: "buff", valence: "positive", duration: null,
    statContribution: function (running, name) {
        if (name === "dodge") return (running || 0) + rankOf(this, "gale") * 4
        return running
    },
})
export const galeReadout = (e, r = 1) => `+${(r || 1) * 4} dodge`

// Swarm — a thousand small bites; every blow lands an extra sting.
export const swarm = defineStatus({
    name: "Swarm", category: "buff", valence: "positive", duration: null,
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) {
            victim.healthPoints -= rankOf(this, "swarm") * 2
        }
        return ret
    },
})
export const swarmReadout = (e, r = 1) => `+${(r || 1) * 2} extra sting per hit`

// Squall — buffeting winds scatter and slow whatever you strike.
export const squall = defineStatus({
    name: "Squall", category: "buff", valence: "positive", duration: null,
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) {
            victim.addTag(slow)
        }
        return ret
    },
})
export const squallReadout = (e, r = 1) => `Slow on hit`
