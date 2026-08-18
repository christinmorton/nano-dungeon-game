import gameLog from "../GameLog.js"
import mapState from "../MapState.js"
import burning from "./burning.js"
import { defineStatus } from "./Status.js"

// Cinder — Fire pool passive trait: a slain enemy BURSTS, spreading Burning to foes
// adjacent to where it fell (the onKill hook). The victim is already removed from the
// map by the time onKill fires, so entityAtTile finds only the survivors around it.
const cinder = defineStatus({
    name: "Cinder",
    category: "buff",
    valence: "mixed",
    duration: null,
    onKill: function (ret, victim) {
        const vx = victim?.x, vy = victim?.y
        if (vx == null || vy == null) return ret
        let spread = 0
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue
                const e = mapState.entityAtTile(vx + dx, vy + dy)
                if (e && e.type === 'enemy' && e.healthPoints > 0 && e !== this) {
                    e.addTag(burning)
                    spread++
                }
            }
        }
        if (spread > 0) gameLog.log(`Cinders leap from the slain — ${spread} foe${spread > 1 ? 's' : ''} catch fire.`)
        return ret
    }
})

export default cinder
