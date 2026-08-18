import gameLog from "../GameLog.js"
import mapState from "../MapState.js"
import slow from "./slow.js"
import { defineStatus } from "./Status.js"

// Cold Snap — Frost pool passive trait: a slain enemy releases a burst of cold that
// SLOWS foes adjacent to where it fell (onKill). The frost cousin of Cinder. The
// victim is already off the map, so entityAtTile finds only the survivors around it.
const coldSnap = defineStatus({
    name: "Cold Snap",
    category: "buff",
    valence: "mixed",
    duration: null,
    onKill: function (ret, victim) {
        const vx = victim?.x, vy = victim?.y
        if (vx == null || vy == null) return ret
        let n = 0
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue
                const e = mapState.entityAtTile(vx + dx, vy + dy)
                if (e && e.type === 'enemy' && e.healthPoints > 0 && e !== this) {
                    e.addTag(slow)
                    n++
                }
            }
        }
        if (n > 0) gameLog.log(`A cold snap radiates from the slain — ${n} foe${n > 1 ? 's' : ''} chilled.`)
        return ret
    }
})

export default coldSnap
