import { defineStatus } from "./Status.js"

// Permanent trait tag behind the Toughness passive: +armor via the stat
// reducer. No duration — attached/detached by the Passive wrapper, not by a
// timer. Valence 'mixed' so it isn't a Dispel-able buff (it's a trait, not a
// temporary blessing).

const TOUGHNESS_ARMOR = 3

const toughness = defineStatus({
    name: "Toughness",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    statContribution: function (running, name) {
        if (name === 'armor') return (running || 0) + TOUGHNESS_ARMOR
        return running
    }
})

export default toughness
