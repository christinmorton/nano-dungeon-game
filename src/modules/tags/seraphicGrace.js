import { defineStatus } from "./Status.js"

// Seraphic Grace — the Seraphic affinity's advanced base passive (§18). Peak Light:
// combines Radiance's restoration AND Aegis's protection, stronger than either —
// regenerates HP each round AND reduces all incoming damage. The pinnacle trait.
const seraphicGrace = defineStatus({
    name: "Seraphic Grace",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (heal = 5, factor = 0.8) {
        this._sgHeal = heal
        this._sgFactor = factor
    },
    refresh: function (baseResult) {
        const heal = this._sgHeal ?? 0
        if (heal > 0 && this.healthPoints > 0) {
            const cap = this.maxHealthPoints ?? (this.healthPoints + heal)
            this.healthPoints = Math.min(cap, this.healthPoints + heal)
        }
        return baseResult
    },
    damageTakenMult: function (mult) {
        return (mult ?? 1) * (this._sgFactor ?? 1)
    }
})

export default seraphicGrace
