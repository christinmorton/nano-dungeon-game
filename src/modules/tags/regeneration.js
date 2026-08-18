import { defineStatus } from "./Status.js"

// Permanent trait tag behind the Regeneration passive: heal 1 HP at each
// refresh (turn boundary), clamped to maxHealthPoints per
// [[feedback-max-is-canonical-stat]]. Distinct from the duration-based Regen
// status (Second Wind) — this one never expires; the Passive wrapper adds
// and removes it. Heals silently to avoid per-turn log spam. Valence 'mixed'
// so it isn't Dispel-able.

const REGEN_PER_TURN = 1

const regeneration = defineStatus({
    name: "Regeneration",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    refresh: function (baseResult) {
        if (this.healthPoints < this.maxHealthPoints) {
            this.healthPoints = Math.min(this.maxHealthPoints, this.healthPoints + REGEN_PER_TURN)
        }
        return baseResult
    }
})

export default regeneration
