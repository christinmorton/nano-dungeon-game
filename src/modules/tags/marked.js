import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Marked — the target takes extra damage from ALL sources for N turns (Hunter's
// Mark). Wraps the entity's damageTakenMult() shim (base 1); resolveDamage and
// Combat.attack multiply final damage by it. The reusable "vulnerable" primitive
// — future Exposed/Sundered-style effects can reuse the same shim.

const marked = defineStatus({
    name: "Marked",
    category: "debuff",
    valence: "negative",
    icon: null,
    duration: 4,
    initialize: function (turns = 4, factor = 1.3) {
        this._markedTurns = turns
        this._markedFactor = factor
        gameLog.log(`${this.name} is marked (+${Math.round((factor - 1) * 100)}% damage taken).`)
    },
    // Wraps damageTakenMult(): base returns 1, we scale it up.
    damageTakenMult: function (mult) {
        return mult * (this._markedFactor ?? 1)
    },
    refresh: function (baseResult) {
        this._markedTurns -= 1
        if (this._markedTurns <= 0) {
            this.removeTag(marked)
            gameLog.log(`${this.name} is no longer marked.`)
        }
        return baseResult
    }
})

export default marked
