import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Berserk — a rage trade-off: +attackPower but lowered defense (block) for
// N turns. The stat swing below is functional via statContribution. The
// design's other half — forcing the entity to make only basic melee
// attacks — needs an input/AI action-override hook that doesn't exist yet
// (TODO). Valence is mixed: an offensive boon but a defensive hazard.

const BERSERK_TINT = 0xff8a8a
const BERSERK_SCALE = 1.15

const berserk = defineStatus({
    name: "Berserk",
    category: "alteration",
    valence: "mixed",
    icon: null,
    duration: 3,
    initialize: function (turns = 3, attackBonus = 3, blockPenalty = 20) {
        this._berserkTurns = turns
        this._berserkAttack = attackBonus
        this._berserkBlock = blockPenalty
        this._berserkPrevTint = this.sprite?.tint
        this._berserkPrevScaleX = this.sprite?.scaleX ?? 1
        this._berserkPrevScaleY = this.sprite?.scaleY ?? 1
        if (this.sprite) {
            this.sprite.tint = BERSERK_TINT
            this.sprite.tintFill = false
            this.sprite.setScale(this._berserkPrevScaleX * BERSERK_SCALE, this._berserkPrevScaleY * BERSERK_SCALE)
        }
        gameLog.log(`${this.name} flies into a rage.`)
    },
    refresh: function (baseResult) {
        this._berserkTurns -= 1
        if (this._berserkTurns <= 0) {
            this.removeTag(berserk)
            gameLog.log(`${this.name}'s rage subsides.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'attackPower') return (running || 0) + this._berserkAttack
        if (name === 'block') return (running || 0) - this._berserkBlock
        return running
    },
    // Visual telegraph — slightly red + larger while raging; restored when the
    // rage subsides (refresh expiry) or it's cleansed/dispelled, via the
    // removeTag cleanup hook.
    cleanup: function () {
        if (this.sprite) {
            if (this._berserkPrevTint !== undefined) this.sprite.tint = this._berserkPrevTint
            else this.sprite.clearTint?.()
            this.sprite.setScale(this._berserkPrevScaleX ?? 1, this._berserkPrevScaleY ?? 1)
        }
    }
    // TODO: also force basic melee attacks while active (needs an action-override hook).
})

export default berserk
