import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Illuminated — the Light affinity's rider (advanced/pact). INTERIM PLACEHOLDER:
// currently just -dodge (statContribution('dodge')) — the target is lit and easy
// to hit. The original anti-stealth design was cut (dead weight: the enemy roster
// isn't stealthed). A more CREATIVE Light effect is parked for design — see
// v3_ability_progression_system.md §17 (candidates: escalating "Radiant Brand"
// exposure, "Revealed Weakness" crits, "Cleansing Light" heal-on-kill). Keep the
// label; rework the body.

const ILLUMINATED_TINT = 0xffffcc

const illuminated = defineStatus({
    name: "Illuminated",
    category: "debuff",
    valence: "negative",
    icon: null,
    fx: "light",
    duration: 3,
    initialize: function (turns = 3, dodgePenalty = 10) {
        this._illumTurns = turns
        this._illumDodge = dodgePenalty
        this._illumPrevTint = this.sprite?.tint
        if (this.sprite) {
            this.sprite.tint = ILLUMINATED_TINT
            this.sprite.tintFill = false
        }
        gameLog.log(`${this.name} is illuminated — exposed to the light.`)
    },
    statContribution: function (running, name) {
        if (name === 'dodge') return (running || 0) - (this._illumDodge ?? 0)
        return running
    },
    refresh: function (baseResult) {
        this._illumTurns -= 1
        if (this._illumTurns <= 0) {
            this.removeTag(illuminated)
            gameLog.log(`${this.name} slips back into the shadows.`)
        }
        return baseResult
    },
    cleanup: function () {
        if (this.sprite) {
            if (this._illumPrevTint !== undefined) {
                this.sprite.tint = this._illumPrevTint
            } else {
                this.sprite.clearTint?.()
            }
        }
    }
})

export default illuminated
