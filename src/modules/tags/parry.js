import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Parry — a temporary NEGATION stance: +N to the `block` derived stat for M turns.
// The block roll runs after dodge and is PHYSICAL-ONLY (Combat.js), so Parry is by
// nature a melee/physical counter — it turns blows aside rather than avoiding them
// (Evasion) or soaking them (Guarded). blockChance = min(0.5, block * 0.03), ~+3%
// per point up to the 50% cap. Flat bonus set by the applier.
const parry = defineStatus({
    name: "Parry",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 3,
    initialize: function (turns = 3, bonus = 8) {
        this._parryTurns = turns
        this._parryBonus = bonus
        gameLog.log(`${this.name} raises a parrying guard (+${bonus} block).`)
    },
    refresh: function (baseResult) {
        this._parryTurns -= 1
        if (this._parryTurns <= 0) {
            this.removeTag(parry)
            gameLog.log(`${this.name} lowers their guard.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'block') return (running || 0) + (this._parryBonus ?? 0)
        return running
    }
})

export default parry
