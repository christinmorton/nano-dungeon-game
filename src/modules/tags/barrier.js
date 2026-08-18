import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"
import { playShieldBubble } from "../Animations.js"

// Barrier — +magicPower to BOTH the 'armor' and 'barrier' derived stats for N
// turns, so it reduces physical AND magic damage taken (via protection('physical')
// -> stat('armor') and protection('magic') -> stat('barrier') in Combat.js). A
// flat per-hit resistance — distinct from Shield, which is a depletable pool.
//
// The bonus is captured at apply time (the caster's magicPower then)
// rather than re-read each tick — so taking off magic gear mid-buff
// doesn't shrink the barrier. Same shape as Cleric's Might / Warrior's
// Bulwark with statContribution.
//
// VISUAL: a translucent shield BUBBLE around the caster for the duration (the
// `color` arg — grey-white for a base barrier; an element-flavored ward passes
// its own color). It snap-follows the caster each round (refresh) and is destroyed
// in cleanup (fired by removeTag on expiry / cleanse).

const BARRIER_GREY = 0xcfd4da

const barrier = defineStatus({
    name: "Barrier",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 4,
    initialize: function (turns = 4, bonus = null, color = BARRIER_GREY) {
        this._barrierTurns = turns
        this._barrierBonus = bonus ?? this.stat('magicPower')
        this._barrierBubble = playShieldBubble(this, { color })
        gameLog.log(`${this.name} raises a barrier (+${this._barrierBonus} physical & magic resist).`)
    },
    refresh: function (baseResult) {
        this._barrierBubble?.reposition?.()        // snap the bubble to the caster's tile
        this._barrierTurns -= 1
        if (this._barrierTurns <= 0) {
            this.removeTag(barrier)
            gameLog.log(`${this.name}'s barrier fades.`)
        }
        return baseResult
    },
    cleanup: function () {
        if (this._barrierBubble) { this._barrierBubble.destroy(); this._barrierBubble = null }
    },
    statContribution: function (running, name) {
        if (name === 'barrier' || name === 'armor') return (running || 0) + (this._barrierBonus ?? 0)
        return running
    }
})

export default barrier
