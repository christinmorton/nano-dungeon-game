import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Aim — +crit chance for N turns (Take Aim). The precision stance: Combat reads
// attacker.stat('critChance'), so this dials the hero's crit up while held. Same
// shape as Might (duration + statContribution + auto-remove).

const aim = defineStatus({
    name: "Aim",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 3,
    initialize: function (turns = 3, bonus = 0.25) {
        this._aimTurns = turns
        this._aimBonus = bonus
        gameLog.log(`${this.name} takes aim (+${Math.round(bonus * 100)}% crit).`)
    },
    refresh: function (baseResult) {
        this._aimTurns -= 1
        if (this._aimTurns <= 0) {
            this.removeTag(aim)
            gameLog.log(`${this.name} eases off the aim.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'critChance') return (running || 0) + (this._aimBonus ?? 0)
        return running
    }
})

export default aim
