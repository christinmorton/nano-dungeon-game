import gameLog from "../GameLog.js"
import mapState from "../MapState.js"
import shocked from "./shocked.js"
import { defineStatus } from "./Status.js"

// Chain Reaction — Lightning pool passive trait: a slain enemy discharges, SHOCKING foes
// adjacent to where it fell (the lightning cousin of Cinder/Cold Snap). The victim is
// already off the map, so entityAtTile finds only the survivors around it.
const chainReaction = defineStatus({
    name: "Chain Reaction",
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
                    e.addTag(shocked)
                    n++
                }
            }
        }
        if (n > 0) gameLog.log(`Arcs leap from the slain — ${n} foe${n > 1 ? 's' : ''} shocked.`)
        return ret
    }
})

export default chainReaction
