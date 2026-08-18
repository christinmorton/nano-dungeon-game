import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Stoneskin — the hide turns to stone: a big flat +armor for N turns (reduces
// physical damage via the protection('physical') -> stat('armor') path). The Earth
// tree's mitigation defense (vs Barrier's all-type resist / Bulwark's block). Same
// shape as Barrier / Might with statContribution.

const stoneskin = defineStatus({
    name: "Stoneskin",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 4,
    initialize: function (turns = 4, bonus = 8) {
        this._stoneskinTurns = turns
        this._stoneskinBonus = bonus
        gameLog.log(`${this.name}'s skin turns to stone (+${bonus} armor).`)
    },
    refresh: function (baseResult) {
        this._stoneskinTurns -= 1
        if (this._stoneskinTurns <= 0) {
            this.removeTag(stoneskin)
            gameLog.log(`${this.name}'s stoneskin crumbles.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'armor') return (running || 0) + (this._stoneskinBonus ?? 0)
        return running
    }
})

export default stoneskin
