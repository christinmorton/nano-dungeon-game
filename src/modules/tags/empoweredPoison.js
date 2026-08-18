import { defineStatus } from "./Status.js"
import poison from "./poison.js"
import slow from "./slow.js"

// Empowered POISON — Old Coil's blessing (§19.6): the great serpent's deepening venom.
// Demi-god tier. Three paths read live rank off `entity.affinityPaths[key].rank`.

const rankOf = (e, k) => e.affinityPaths?.[k]?.rank || 1

// Venom — envenom every strike and savage the already-poisoned.
export const venom = defineStatus({
    name: "Venom", category: "buff", valence: "positive", duration: null,
    outgoingDamageMult: function (running, victim) {
        const m = running ?? 1
        return victim?._tags?.includes?.("Poison") ? m * (1 + rankOf(this, "venom") * 0.15) : m
    },
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) victim.addTag(poison)
        return ret
    },
})
export const venomReadout = (e, r = 1) => `Poison on hit · +${Math.round((r || 1) * 15)}% vs Poisoned`

// Constrict — the serpent's coils Slow the prey and drain its life into you.
export const constrict = defineStatus({
    name: "Constrict", category: "buff", valence: "positive", duration: null,
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) {
            victim.addTag(slow)
            if (this.healthPoints > 0) this.healthPoints = Math.min(this.maxHealthPoints ?? this.healthPoints, this.healthPoints + rankOf(this, "constrict") * 2)
        }
        return ret
    },
})
export const constrictReadout = (e, r = 1) => `Slow on hit · drain ${(r || 1) * 2} HP`

// Shed — the serpent's poisoned skin; strikers are envenomed, and it renews itself.
export const shed = defineStatus({
    name: "Shed", category: "buff", valence: "positive", duration: null,
    onDamaged: function (ret, attacker, dealt) {
        if (attacker?.sprite && attacker !== this && attacker.healthPoints > 0) attacker.addTag(poison)
        return ret
    },
    refresh: function (baseResult) {
        if (this.healthPoints > 0) this.healthPoints = Math.min(this.maxHealthPoints ?? this.healthPoints, this.healthPoints + rankOf(this, "shed") * 2)
        return baseResult
    },
})
export const shedReadout = (e, r = 1) => `envenom strikers · regen ${(r || 1) * 2}/turn`
