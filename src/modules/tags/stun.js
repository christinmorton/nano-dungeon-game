import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Stun — the entity skips its turn (no movement, no action). Applied
// by abilities like Warrior Charge on hit. Decrements via the wrapped
// turn() handler each time the entity ticks; BaseEnemy.turn() reads
// `_tags.includes("Stun")` to skip its archetype call AND zero MP/AP
// so the entity registers as over() after the first call. Duration 1
// = skip exactly one upcoming turn.

const stun = defineStatus({
    name: "Stun",
    category: "cc",
    valence: "negative",
    icon: null,
    fx: "stun",
    duration: 1,
    initialize: function (turns = 1) {
        this._stunTurns = turns
        gameLog.log(`${this.name} is stunned.`)
    },
    turn: function () {
        this._stunTurns -= 1
        if (this._stunTurns <= 0) {
            this.removeTag(stun)
        }
    }
})

// Apply a "slam" stun: the entity loses the REST of this turn (its AP/MP are
// spent on the spot) AND is stunned for its next turn (the Stun tag skips it).
// The composite a hard knockback impact wants — heavier than a plain
// addTag(stun), which only skips the next turn.
export function applyStun(entity) {
    if (!entity?.sprite) return
    entity.actionPoints = 0
    entity.movementPoints = 0
    entity.addTag(stun)
}

export default stun
