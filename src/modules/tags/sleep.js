import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Sleep — the entity can't act (MP/AP zeroed each refresh) until the
// duration ends OR it takes a hit. "Breaks on damage" routes through the
// protection hook: Combat calls victim.protection(type) on every incoming
// attack (before damage applies), which is the reliable "I'm being
// attacked" signal — no victim-side `damaged` hook is wired. The handler
// removes the tag and passes the running mitigation through unchanged.

const sleep = defineStatus({
    name: "Sleep",
    category: "cc",
    valence: "negative",
    icon: null,
    duration: 3,
    initialize: function (turns = 3) {
        this._sleepTurns = turns
        gameLog.log(`${this.name} falls asleep.`)
    },
    refresh: function (baseResult) {
        this.movementPoints = 0
        this.actionPoints = 0
        this._sleepTurns -= 1
        if (this._sleepTurns <= 0) {
            this.removeTag(sleep)
            gameLog.log(`${this.name} wakes up.`)
        }
        return baseResult
    },
    protection: function (running) {
        this.removeTag(sleep)
        gameLog.log(`${this.name} is jolted awake!`)
        return running
    }
})

export default sleep
