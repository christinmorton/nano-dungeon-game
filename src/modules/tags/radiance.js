import { defineStatus } from "./Status.js"

// Radiance — the Light affinity's advanced base passive (§18). Light is RESTORATION:
// the bearer regenerates a flat HP each round. Heals DIRECT (clamped to maxHP) so it
// stays a leaf tag. Permanent (duration null); attached/detached by the affinity.
const radiance = defineStatus({
    name: "Radiance",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (heal = 3) { this._radiance = heal },
    refresh: function (baseResult) {
        const heal = this._radiance ?? 0
        if (heal > 0 && this.healthPoints > 0) {
            const cap = this.maxHealthPoints ?? (this.healthPoints + heal)
            this.healthPoints = Math.min(cap, this.healthPoints + heal)
        }
        return baseResult
    }
})

export default radiance
