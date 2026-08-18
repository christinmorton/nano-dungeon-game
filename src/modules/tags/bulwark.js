import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Applied by the Warrior's Bulwark ability. Contributes +50 to the
// `block` stat so the existing blockChance formula (stat('block') *
// 0.03, capped at 0.5) pins to the 0.5 ceiling for the buff's
// duration — the "+50% block chance" effect from documents/v3_abilities.md
// without inventing a new bypass for the cap. Ticks down each hero
// refresh() and removes itself at 0.

const BULWARK_TINT = 0xd0d0dc
const BULWARK_SCALE = 1.15

const bulwark = defineStatus({
    name: "Bulwark",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 3,
    initialize: function (turns = 3) {
        this._bulwarkTurns = turns
        this._bulwarkPrevTint = this.sprite?.tint
        this._bulwarkPrevScaleX = this.sprite?.scaleX ?? 1
        this._bulwarkPrevScaleY = this.sprite?.scaleY ?? 1
        if (this.sprite) {
            this.sprite.tint = BULWARK_TINT
            this.sprite.tintFill = false
            this.sprite.setScale(this._bulwarkPrevScaleX * BULWARK_SCALE, this._bulwarkPrevScaleY * BULWARK_SCALE)
        }
        gameLog.log(`${this.name} raises a bulwark.`)
    },
    refresh: function (baseResult) {
        this._bulwarkTurns -= 1
        if (this._bulwarkTurns <= 0) {
            this.removeTag(bulwark)
            gameLog.log(`${this.name}'s bulwark fades.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'block') return (running || 0) + 50
        return running
    },
    // Visual telegraph — slightly silver + larger while the bulwark holds;
    // restored on expiry or cleanse/dispel via the removeTag cleanup hook.
    cleanup: function () {
        if (this.sprite) {
            if (this._bulwarkPrevTint !== undefined) this.sprite.tint = this._bulwarkPrevTint
            else this.sprite.clearTint?.()
            this.sprite.setScale(this._bulwarkPrevScaleX ?? 1, this._bulwarkPrevScaleY ?? 1)
        }
    }
})

export default bulwark
