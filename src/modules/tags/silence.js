import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Silence — prevents casting abilities for N turns. STUB: the gate belongs
// in Ability.canActivate (reject spell-type abilities while the caster is
// Silenced), but abilities carry no "isSpell" flag yet. Duration handling
// below is real; the cast-block is a TODO.

const silence = defineStatus({
    name: "Silence",
    category: "cc",
    valence: "negative",
    icon: null,
    duration: 3,
    initialize: function (turns = 3) {
        this._silenceTurns = turns
        gameLog.log(`${this.name} is silenced.`)
    },
    refresh: function (baseResult) {
        this._silenceTurns -= 1
        if (this._silenceTurns <= 0) {
            this.removeTag(silence)
            gameLog.log(`${this.name} can cast again.`)
        }
        return baseResult
    }
    // TODO: block spell-type abilities in Ability.canActivate when this tag is present.
})

export default silence
