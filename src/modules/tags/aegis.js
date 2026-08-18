import { defineStatus } from "./Status.js"

// Aegis — the Holy affinity's advanced base passive (§18). Divine protection: the
// bearer takes less damage from ALL sources (wraps the entity's own damageTakenMult,
// the same primitive Marked/Shocked use to INCREASE — here it lowers it). Permanent.
const aegis = defineStatus({
    name: "Aegis",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (factor = 0.85) { this._aegis = factor },
    damageTakenMult: function (mult) {
        return (mult ?? 1) * (this._aegis ?? 1)
    }
})

export default aegis
