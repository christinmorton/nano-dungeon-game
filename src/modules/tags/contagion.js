import gameLog from "../GameLog.js"
import mapState from "../MapState.js"
import poison from "./poison.js"
import { defineStatus } from "./Status.js"

// Contagion — Poison pool passive trait: a slain enemy's toxins spread, POISONING foes
// adjacent to where it fell (the poison cousin of Cinder/Cold Snap). The victim is
// already off the map, so entityAtTile finds only the survivors around it.
const contagion = defineStatus({
    name: "Contagion",
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
                    e.addTag(poison)
                    n++
                }
            }
        }
        if (n > 0) gameLog.log(`The plague spreads from the slain — ${n} foe${n > 1 ? 's' : ''} poisoned.`)
        return ret
    }
})

export default contagion
