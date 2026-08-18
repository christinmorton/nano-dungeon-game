import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Evasion — a temporary AVOIDANCE stance: +N to the `dodge` derived stat for M
// turns, so the Combat dodge roll (rolled first, before block/armor, for ALL
// damage types) fires far more often. The avoidance counterpart to the
// mitigation defenses (Guarded/Bulwark reduce a hit; Evasion skips it entirely).
// dodgeChance = min(0.5, dodge * 0.03), so each point is ~+3% up to the 50% cap —
// a strong spike pushes an agile hero (Elf) to the cap for the window. Flat bonus
// set by the applier (not stat-scaled).
const evasion = defineStatus({
    name: "Evasion",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 3,
    initialize: function (turns = 3, bonus = 8) {
        this._evasionTurns = turns
        this._evasionBonus = bonus
        gameLog.log(`${this.name} becomes evasive (+${bonus} dodge).`)
    },
    refresh: function (baseResult) {
        this._evasionTurns -= 1
        if (this._evasionTurns <= 0) {
            this.removeTag(evasion)
            gameLog.log(`${this.name}'s evasion fades.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'dodge') return (running || 0) + (this._evasionBonus ?? 0)
        return running
    }
})

export default evasion
