import gameLog from "../GameLog.js"
import { heal } from "../abilities/universals.js"
import { defineStatus } from "./Status.js"

// Permanent trait tag behind the Survivalist passive: regenerate HP each round
// while OUT of combat — the wilderness recovery that lets a skirmisher top off
// between fights without resting. Gated on the hero's inCombat() recency signal;
// an entity without that signal (an enemy) just regenerates steadily. No duration
// — managed by the Passive wrapper.

const SURVIVALIST_REGEN = 3

const survivalist = defineStatus({
    name: "Survivalist",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    refresh: function (baseResult) {
        // Recover only when not recently in combat (recovery between fights).
        if (this.inCombat?.()) return baseResult
        const healed = heal(this, SURVIVALIST_REGEN)
        if (healed > 0) gameLog.log(`${this.name} recovers (+${healed} HP).`)
        return baseResult
    }
})

export default survivalist
