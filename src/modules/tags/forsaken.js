import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Forsaken — the mark of BROKEN FAITH. Applied to a hero who breaks a pact the raw
// way (BaseHero.breakPact): the cosmic power's favor curdles into a lingering
// penalty — blows land softer (outgoingDamageMult) and wounds knit slower
// (incomingHealMult) for a while. This is the cost that makes a Shrine's clean
// dissolve worth paying for. Temporary (counts down on its own).
const forsaken = defineStatus({
    name: "Forsaken",
    category: "debuff",
    valence: "negative",
    icon: null,
    fx: "void",
    duration: 20,
    initialize: function (turns = 20) {
        this._forsakenTurns = turns
        gameLog.log(`${this.name} is Forsaken — broken faith curdles into a mark.`)
    },
    outgoingDamageMult: function (running) {
        return (running ?? 1) * 0.8
    },
    incomingHealMult: function (mult) {
        return (mult ?? 1) * 0.5
    },
    refresh: function (baseResult) {
        this._forsakenTurns -= 1
        if (this._forsakenTurns <= 0) {
            this.removeTag(forsaken)
            gameLog.log(`${this.name}'s Forsaken mark fades.`)
        }
        return baseResult
    },
})

export default forsaken
