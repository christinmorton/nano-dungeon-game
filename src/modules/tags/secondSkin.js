import { defineStatus } from "./Status.js"

// Permanent trait tag behind the Second Skin passive: +armor AND a little +dodge
// (a tough, agile hide) — distinct from Toughness (pure armor). No duration —
// attached/detached by the Passive wrapper. Valence 'mixed' so it isn't a
// Dispel-able buff (it's a trait, not a temporary blessing).

const SECOND_SKIN_ARMOR = 3
const SECOND_SKIN_DODGE = 1

const secondSkin = defineStatus({
    name: "Second Skin",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    statContribution: function (running, name) {
        if (name === 'armor') return (running || 0) + SECOND_SKIN_ARMOR
        if (name === 'dodge') return (running || 0) + SECOND_SKIN_DODGE
        return running
    }
})

export default secondSkin
