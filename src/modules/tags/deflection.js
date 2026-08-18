import { defineStatus } from "./Status.js"

// Permanent trait tag behind the Deflection passive: +block (a trained guard that
// turns physical blows aside). The block-stat cousin of Toughness (+armor) and
// Second Skin (+dodge) — completing the armor/dodge/block passive trio. No
// duration; attached/detached by the Passive wrapper. Valence 'mixed' (a trait,
// not a Dispel-able blessing). Block is physical-only (Combat.js).

const DEFLECTION_BLOCK = 2

const deflection = defineStatus({
    name: "Deflection",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    statContribution: function (running, name) {
        if (name === 'block') return (running || 0) + DEFLECTION_BLOCK
        return running
    }
})

export default deflection
