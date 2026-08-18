import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Stasis — frozen in TIME: a hard skip that zeros both movementPoints and
// actionPoints each refresh, so the entity can neither move nor act while held.
// The Time tree's signature CC (Stasis nova + single-target Lock). Mechanically
// the twin of Freeze (self-contained resource-zeroing, so it works on heroes and
// enemies alike) but TIME-flavored — a pale azure shimmer, no cold/thaw framing
// and no interaction with fire/ice. Restored on release.

const STASIS_TINT = 0xbfe6ff

const stasis = defineStatus({
    name: "Stasis",
    category: "cc",
    valence: "negative",
    icon: null,
    fx: "freeze",
    duration: 2,
    initialize: function (turns = 2) {
        this._stasisTurns = turns
        this._stasisPrevTint = this.sprite?.tint
        if (this.sprite) {
            this.sprite.tint = STASIS_TINT
            this.sprite.tintFill = false
        }
        gameLog.log(`${this.name} is frozen in time.`)
    },
    refresh: function (baseResult) {
        this.movementPoints = 0
        this.actionPoints = 0
        this._stasisTurns -= 1
        if (this._stasisTurns <= 0) {
            this.removeTag(stasis)
            gameLog.log(`Time resumes for ${this.name}.`)
        }
        return baseResult
    },
    cleanup: function () {
        if (this.sprite) {
            if (this._stasisPrevTint !== undefined) {
                this.sprite.tint = this._stasisPrevTint
            } else {
                this.sprite.clearTint?.()
            }
        }
    }
})

export default stasis
