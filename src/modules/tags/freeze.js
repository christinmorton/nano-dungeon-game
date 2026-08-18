import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Freeze — a hard skip: zeros both movementPoints and actionPoints each
// refresh so the entity can neither move nor act while frozen. Unlike
// Stun (which is read by BaseEnemy.turn by name), this is self-contained
// via resource-zeroing, so it works for heroes and enemies alike. Ice
// tint telegraphs it; restored on thaw.

const FREEZE_TINT = 0x99ddff

const freeze = defineStatus({
    name: "Freeze",
    category: "cc",
    valence: "negative",
    icon: null,
    fx: "freeze",
    duration: 2,
    initialize: function (turns = 2) {
        this._freezeTurns = turns
        this._freezePrevTint = this.sprite?.tint
        if (this.sprite) {
            this.sprite.tint = FREEZE_TINT
            this.sprite.tintFill = false
        }
        gameLog.log(`${this.name} is frozen solid.`)
    },
    refresh: function (baseResult) {
        this.movementPoints = 0
        this.actionPoints = 0
        this._freezeTurns -= 1
        if (this._freezeTurns <= 0) {
            this.removeTag(freeze)
            gameLog.log(`${this.name} thaws out.`)
        }
        return baseResult
    },
    // Teardown — restore tint. Fires on natural expiry above AND on an
    // early cleanse/dispel, via Taggable.removeTag's cleanup hook.
    cleanup: function () {
        if (this.sprite) {
            if (this._freezePrevTint !== undefined) {
                this.sprite.tint = this._freezePrevTint
            } else {
                this.sprite.clearTint?.()
            }
        }
    }
})

export default freeze
