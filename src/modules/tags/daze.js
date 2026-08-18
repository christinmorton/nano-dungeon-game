import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Daze — a soft stagger, the light-CC twin of Stun. A dazed entity skips its NEXT
// turn (1 turn by default), but UNLIKE a slam-stun it does not also drop the
// current round on top of that — so it's reliably one lost action, vs the
// slam-stun's "this turn + next". BaseEnemy.turn() honors the Daze tag exactly the
// way it honors Stun (zero AP/MP + skip the archetype), so the skip is reliable
// regardless of turn order. Reuses the "seeing stars" overlay (fx: 'daze').
// Secondary targets of a slam / shockwave get dazed; the primary gets stunned.
const daze = defineStatus({
    name: "Daze",
    category: "cc",
    valence: "negative",
    icon: null,
    fx: "daze",
    duration: 1,
    initialize: function (turns = 1) {
        this._dazeTurns = turns
        gameLog.log(`${this.name} is dazed.`)
    },
    turn: function () {
        this._dazeTurns -= 1
        if (this._dazeTurns <= 0) this.removeTag(daze)
    }
})

// Apply a daze: the entity skips its next `turns` turns (the actual skip is
// enforced in BaseEnemy.turn). Dedups by name like every tag.
export function applyDaze(entity, turns = 1) {
    if (!entity?.sprite) return
    entity.addTag(daze, turns)
}

export default daze
