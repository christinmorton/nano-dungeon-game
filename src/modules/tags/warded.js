import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Warded — a temporary MAGIC-resistance buff: +N to the `barrier` derived stat
// (protection('magic') -> stat('barrier') in Combat) for M turns, blunting
// incoming SPELL damage without touching physical armor. The magic-only cousin of
// Bulwark/Barrier. A FLAT bonus set by the applier (NOT magicPower-scaled) — a
// martial warder shouldn't lean on its low Magic stat. Used by Spell Ward (self)
// and Warding Banner (party aura).
const warded = defineStatus({
    name: "Warded",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 4,
    initialize: function (turns = 4, bonus = 6) {
        this._wardedTurns = turns
        this._wardedBonus = bonus
        gameLog.log(`${this.name} wards against magic (+${bonus} magic resist).`)
    },
    refresh: function (baseResult) {
        this._wardedTurns -= 1
        if (this._wardedTurns <= 0) {
            this.removeTag(warded)
            gameLog.log(`${this.name}'s ward fades.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'barrier') return (running || 0) + (this._wardedBonus ?? 0)
        return running
    }
})

export default warded
