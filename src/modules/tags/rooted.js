import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Rooted — the entity can't move but can still attack. Applied by Elf
// Root. BaseEnemy.turn() zeros movementPoints (but NOT actionPoints)
// when this tag is present, so the archetype still runs and can swing
// from its current tile.
//
// Duration ticks down each refresh; auto-removes at 0. Tints green to
// telegraph the state.

const ROOTED_TINT = 0x4ade80

const rooted = defineStatus({
    name: "Rooted",
    category: "cc",
    valence: "negative",
    icon: null,
    duration: 5,
    initialize: function (turns = 5) {
        this._rootedTurns = turns
        this._rootedPrevTint = this.sprite?.tint
        if (this.sprite) {
            this.sprite.tint = ROOTED_TINT
            this.sprite.tintFill = false
        }
        gameLog.log(`${this.name} is rooted in place.`)
    },
    refresh: function (baseResult) {
        this._rootedTurns -= 1
        if (this._rootedTurns <= 0) {
            this.removeTag(rooted)
            gameLog.log(`${this.name} is no longer rooted.`)
        }
        return baseResult
    },
    // Teardown — restore tint. Fires on natural expiry above AND on an
    // early cleanse/dispel, via Taggable.removeTag's cleanup hook.
    cleanup: function () {
        if (this.sprite) {
            if (this._rootedPrevTint !== undefined) {
                this.sprite.tint = this._rootedPrevTint
            } else {
                this.sprite.clearTint?.()
            }
        }
    }
})

export default rooted
