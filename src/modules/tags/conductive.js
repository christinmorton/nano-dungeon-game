import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Conductive — the target is charged with current and takes extra damage from ALL
// sources for N turns (Storm's burst setup). The lightning-flavored cousin of
// Marked (Hunter's Mark): both wrap the entity's damageTakenMult() shim — the
// reusable "vulnerable" primitive — but as DISTINCT statuses (so they read right
// and don't collide in the registry).

const conductive = defineStatus({
    name: "Conductive",
    category: "debuff",
    valence: "negative",
    icon: null,
    duration: 3,
    initialize: function (turns = 3, factor = 1.3) {
        this._conductiveTurns = turns
        this._conductiveFactor = factor
        gameLog.log(`${this.name} is charged conductive (+${Math.round((factor - 1) * 100)}% damage taken).`)
    },
    damageTakenMult: function (mult) {
        return mult * (this._conductiveFactor ?? 1)
    },
    refresh: function (baseResult) {
        this._conductiveTurns -= 1
        if (this._conductiveTurns <= 0) {
            this.removeTag(conductive)
            gameLog.log(`${this.name} is no longer conductive.`)
        }
        return baseResult
    }
})

export default conductive
