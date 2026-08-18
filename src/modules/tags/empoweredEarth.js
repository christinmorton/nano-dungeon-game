import { defineStatus } from "./Status.js"
import stun from "./stun.js"

// Empowered EARTH — Mountain's Tooth's blessing (§19.6): the immovable mountain made flesh.
// Demi-god tier. Three paths read live rank off `entity.affinityPaths[key].rank`.

const rankOf = (e, k) => e.affinityPaths?.[k]?.rank || 1

// Mountainguard — take far less damage; wear the mountain's stone.
export const mountainguard = defineStatus({
    name: "Mountainguard", category: "buff", valence: "positive", duration: null,
    damageTakenMult: function (mult) {
        return (mult ?? 1) * (1 - Math.min(0.5, rankOf(this, "mountainguard") * 0.06))
    },
    statContribution: function (running, name) {
        if (name === "armor") return (running || 0) + rankOf(this, "mountainguard") * 3
        return running
    },
})
export const mountainguardReadout = (e, r = 1) => `-${Math.round((r || 1) * 6)}% damage taken · +${(r || 1) * 3} armor`

// Tremor — the mountain's blow can stagger; each hit may Stun.
export const tremor = defineStatus({
    name: "Tremor", category: "buff", valence: "positive", duration: null,
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) {
            if (Math.random() < rankOf(this, "tremor") * 0.15) victim.addTag(stun)
        }
        return ret
    },
})
export const tremorReadout = (e, r = 1) => `${Math.round((r || 1) * 15)}% chance to Stun on hit`

// Endurance — the mountain endures; knit back together each round.
export const endurance = defineStatus({
    name: "Endurance", category: "buff", valence: "positive", duration: null,
    refresh: function (baseResult) {
        const heal = rankOf(this, "endure") * 4
        if (this.healthPoints > 0) this.healthPoints = Math.min(this.maxHealthPoints ?? this.healthPoints, this.healthPoints + heal)
        return baseResult
    },
})
export const enduranceReadout = (e, r = 1) => `regen ${(r || 1) * 4}/turn`
