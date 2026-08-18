import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Petrify — turned to stone: can't act (MP/AP zeroed each refresh) and SPD
// is forced to 0 via statContribution. Stone-grey tint telegraphs it,
// restored when it breaks. The design's gradual 3-turn petrification is
// simplified to a flat hold for now.

const PETRIFY_TINT = 0x9a9a9a

const petrify = defineStatus({
    name: "Petrify",
    category: "progression",
    valence: "negative",
    icon: null,
    duration: 3,
    initialize: function (turns = 3) {
        this._petrifyTurns = turns
        this._petrifyPrevTint = this.sprite?.tint
        if (this.sprite) {
            this.sprite.tint = PETRIFY_TINT
            this.sprite.tintFill = false
        }
        gameLog.log(`${this.name} is turning to stone.`)
    },
    refresh: function (baseResult) {
        this.movementPoints = 0
        this.actionPoints = 0
        this._petrifyTurns -= 1
        if (this._petrifyTurns <= 0) {
            this.removeTag(petrify)
            gameLog.log(`${this.name} breaks free of the stone.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'SPD') return 0
        return running
    },
    // Teardown — restore tint. Fires on natural expiry above AND on an
    // early cleanse/dispel, via Taggable.removeTag's cleanup hook.
    cleanup: function () {
        if (this.sprite) {
            if (this._petrifyPrevTint !== undefined) {
                this.sprite.tint = this._petrifyPrevTint
            } else {
                this.sprite.clearTint?.()
            }
        }
    }
})

export default petrify
