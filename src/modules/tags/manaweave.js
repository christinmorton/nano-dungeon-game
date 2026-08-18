import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Manaweave — +magicPower for N turns. The caster's raw-power steroid: the
// magicPower analog of Focus's +attack. magicPower scales every spell's damage
// through rollDamage(), so this empowers the whole Arcane kit while held. Same
// shape as Focus / Might.

const manaweave = defineStatus({
    name: "Manaweave",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 4,
    initialize: function (turns = 4, bonus = 4) {
        this._manaweaveTurns = turns
        this._manaweaveBonus = bonus
        gameLog.log(`${this.name} weaves the mana (+${bonus} magic).`)
    },
    refresh: function (baseResult) {
        this._manaweaveTurns -= 1
        if (this._manaweaveTurns <= 0) {
            this.removeTag(manaweave)
            gameLog.log(`${this.name}'s manaweave unravels.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'magicPower') return (running || 0) + (this._manaweaveBonus ?? 0)
        return running
    }
})

export default manaweave
