import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Empowered PHYSICAL — The Undying's blessing (§19.6): NOT undead flesh but a MYTHIC
// CHAMPION OF LEGEND — a hero of older mortal ages who lives on through myth. Demi-god
// tier. Three paths read live rank off `entity.affinityPaths[key].rank`.

const rankOf = (e, k) => e.affinityPaths?.[k]?.rank || 1

// Valor — the champion's heroic might; every blow strikes truer.
export const valor = defineStatus({
    name: "Valor", category: "buff", valence: "positive", duration: null,
    outgoingDamageMult: function (running, victim) {
        return (running ?? 1) * (1 + rankOf(this, "valor") * 0.06)
    },
})
export const valorReadout = (e, r = 1) => `+${Math.round((r || 1) * 6)}% damage`

// Undying — the legend that will not fall; harder to wound, and a felled foe renews you.
export const undying = defineStatus({
    name: "Undying", category: "buff", valence: "positive", duration: null,
    damageTakenMult: function (mult) {
        return (mult ?? 1) * (1 - Math.min(0.4, rankOf(this, "undying") * 0.04))
    },
    onKill: function (ret, victim) {
        const heal = rankOf(this, "undying") * 5
        if (this.healthPoints > 0) this.healthPoints = Math.min(this.maxHealthPoints ?? this.healthPoints, this.healthPoints + heal)
        gameLog.log(`${this.name}'s legend endures — renewed by the deed (+${heal}).`)
        return ret
    },
})
export const undyingReadout = (e, r = 1) => `-${Math.round((r || 1) * 4)}% damage taken · +${(r || 1) * 5} HP on kill`

// Renown — lives on through myth; the champion's presence heartens all who fight beside.
export const renown = defineStatus({
    name: "Renown", category: "buff", valence: "positive", duration: null,
    refresh: function (baseResult) {
        const heal = rankOf(this, "renown") * 3
        const mend = (u) => { if (u && u.healthPoints > 0) u.healthPoints = Math.min(u.maxHealthPoints ?? u.healthPoints, u.healthPoints + heal) }
        mend(this)
        for (const ally of this.party || []) mend(ally)
        return baseResult
    },
})
export const renownReadout = (e, r = 1) => `heartens the party — regen ${(r || 1) * 3}/turn to all`
