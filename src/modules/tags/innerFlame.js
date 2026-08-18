import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Inner Flame — +magicPower for N turns: the Fire tree's power steroid. A short,
// strong BURST (vs the steadier arcane Manaweave), so it rewards "go loud" timing.
// magicPower scales every fire spell's damage via rollDamage(). Same shape as
// Focus / Manaweave / Might.

const innerFlame = defineStatus({
    name: "Inner Flame",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 3,
    initialize: function (turns = 3, bonus = 6) {
        this._innerFlameTurns = turns
        this._innerFlameBonus = bonus
        gameLog.log(`${this.name} blazes with inner flame (+${bonus} magic).`)
    },
    refresh: function (baseResult) {
        this._innerFlameTurns -= 1
        if (this._innerFlameTurns <= 0) {
            this.removeTag(innerFlame)
            gameLog.log(`${this.name}'s inner flame dims.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'magicPower') return (running || 0) + (this._innerFlameBonus ?? 0)
        return running
    }
})

export default innerFlame
