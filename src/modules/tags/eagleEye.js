import { defineStatus } from "./Status.js"

// Permanent trait tag behind the Eagle Eye passive: +crit chance via the stat
// reducer (Combat rolls attacker crit from stat('critChance')). No duration —
// attached/detached by the Passive wrapper. The ranged precision counterpart to
// Keen Edge (+attack). Valence 'mixed' so it isn't a dispellable buff.

const EAGLE_EYE_CRIT = 0.10

const eagleEye = defineStatus({
    name: "Eagle Eye",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    statContribution: function (running, name) {
        if (name === 'critChance') return (running || 0) + EAGLE_EYE_CRIT
        return running
    }
})

export default eagleEye
