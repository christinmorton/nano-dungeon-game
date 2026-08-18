import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Slow — -1 MP per turn for N turns. Applied by Wizard Frost Bolt.
// Runs in the tag's refresh hook (after BaseHero/BaseEnemy.refresh
// has already refilled movementPoints), so the entity effectively
// gets one fewer MP each turn the tag is active.
//
// Ice-blue tint telegraphs the state. Auto-removes at duration end.
// Re-application during the buff is a no-op (Taggable dedupes by name).

const SLOW_TINT = 0x6ab8ff

const slow = defineStatus({
    name: "Slow",
    category: "debuff",
    valence: "negative",
    icon: null,
    duration: 2,
    initialize: function (turns = 2) {
        this._slowTurns = turns
        this._slowPrevTint = this.sprite?.tint
        if (this.sprite) {
            this.sprite.tint = SLOW_TINT
            this.sprite.tintFill = false
        }
        gameLog.log(`${this.name} is slowed.`)
    },
    refresh: function (baseResult) {
        this.movementPoints = Math.max(0, this.movementPoints - 1)
        this._slowTurns -= 1
        if (this._slowTurns <= 0) {
            this.removeTag(slow)
            gameLog.log(`${this.name} is no longer slowed.`)
        }
        return baseResult
    },
    // Teardown — restore tint. Fires on natural expiry above AND on an
    // early cleanse/dispel, via Taggable.removeTag's cleanup hook.
    cleanup: function () {
        if (this.sprite) {
            if (this._slowPrevTint !== undefined) {
                this.sprite.tint = this._slowPrevTint
            } else {
                this.sprite.clearTint?.()
            }
        }
    }
})

export default slow
