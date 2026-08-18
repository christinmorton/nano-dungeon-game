import { defineStatus } from "./Status.js"

// Oblivion — the Void affinity's advanced base passive (§18). The Void UNMAKES
// defenses: the bearer's damage ignores a flat amount of the target's protection,
// BOTH armor and barrier (armorPen is subtracted from protection for the hit's
// damageType in Combat + resolveDamage). Permanent trait.
const oblivion = defineStatus({
    name: "Oblivion",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (pen = 4) { this._oblivion = pen },
    armorPen: function (running, damageType) {
        return (running || 0) + (this._oblivion ?? 0)
    }
})

export default oblivion
