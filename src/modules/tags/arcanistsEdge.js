import { defineStatus } from "./Status.js"

// Arcanist's Edge — permanent trait behind the passive of the same name: +crit
// chance. `critChance` is a 0–1 probability (Combat rolls Math.random() < critChance),
// so the default 0.08 = +8%.
const arcanistsEdge = defineStatus({
    name: "Arcanist's Edge",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (bonus = 0.08) { this._arcanistsEdge = bonus },
    statContribution: function (running, name) {
        if (name === 'critChance') return (running || 0) + (this._arcanistsEdge ?? 0)
        return running
    }
})

export default arcanistsEdge
