import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Invisible — perception block + "strike from stealth" damage bonus on
// the breaking attack. Applied by Ranger Stealth.
//
// While active:
//   - Perception.canSee returns false against this entity (enemy notice
//     checks fail uniformly)
//   - Sprite drops to alpha 0.4 so the player sees the state
//
// Breaks on attack:
//   - The `attack` hook fires when entity.attack() resolves. Adds
//     +floor(DEX/2) to the damage AND removes the tag in the same step.
//     After removal the wrapped attack() still calls executeTag('attack')
//     but the handler list is empty, so base damage flows through.
//
// Auto-removes at duration end via refresh().

const INVISIBLE_ALPHA = 0.4

const invisible = defineStatus({
    name: "Invisible",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 4,
    initialize: function (turns = 4) {
        this._invisibleTurns = turns
        this._invisiblePrevAlpha = this.sprite?.alpha ?? 1
        if (this.sprite) this.sprite.alpha = INVISIBLE_ALPHA
        gameLog.log(`${this.name} fades into stealth.`)
    },
    refresh: function (baseResult) {
        this._invisibleTurns -= 1
        if (this._invisibleTurns <= 0) {
            this.removeTag(invisible)
            gameLog.log(`${this.name}'s stealth fades.`)
        }
        return baseResult
    },
    attack: function (baseDamage) {
        const bonus = Math.floor(this.stat('DEX') / 2)
        this.removeTag(invisible)
        gameLog.log(`${this.name} strikes from stealth for +${bonus} damage!`)
        return (baseDamage || 0) + bonus
    },
    // Teardown — restore alpha. Fires on natural expiry, on the breaking
    // attack above, AND on an early cleanse/dispel, via removeTag's hook.
    cleanup: function () {
        if (this.sprite) this.sprite.alpha = this._invisiblePrevAlpha ?? 1
    }
})

export default invisible
