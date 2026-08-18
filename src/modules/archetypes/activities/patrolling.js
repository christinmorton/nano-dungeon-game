import mapState from "../../MapState.js"
import gameLog from "../../GameLog.js"
import { findAlliesInRange, issueOrder } from "../captain.js"

const PATROL_COOLDOWN = 3
const PATROL_RADIUS = 10
const PATROL_TILE_ATTEMPTS = 20

// Pick a patrol target tile. When the captain has a homeRoom,
// patrols stay inside it — keeps patrollers from getting stuck
// trying to path through closed doors out of the captain's room.
// Falls back to a PATROL_RADIUS-bounded random walkable tile around
// the captain (arena-style) otherwise.
function pickPatrolTarget(captain) {
    if (captain.homeRoom) {
        const room = captain.homeRoom
        return mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
    }
    const maxY = mapState.level.length
    const maxX = mapState.level[0].length
    for (let i = 0; i < PATROL_TILE_ATTEMPTS; i++) {
        const dx = Math.floor(Math.random() * (PATROL_RADIUS * 2 + 1)) - PATROL_RADIUS
        const dy = Math.floor(Math.random() * (PATROL_RADIUS * 2 + 1)) - PATROL_RADIUS
        if (dx === 0 && dy === 0) continue
        const tx = captain.x + dx
        const ty = captain.y + dy
        // Bounds-check before isWalkableTile — its underlying
        // map.getTileAt returns null off-map, which crashes the
        // subsequent .index read inside the helper.
        if (tx < 0 || tx >= maxX || ty < 0 || ty >= maxY) continue
        if (mapState.isWalkableTile(tx, ty)) return { x: tx, y: ty }
    }
    return null
}

// Patrolling activity — the captain dispatches one idle squad member
// at a time on a short walk to a random tile near the captain. Reuses
// the existing "go-to" command machinery; the clearOnArrival flag on
// the order makes the patroller idle out (vs. formation slots which
// stay pinned). Captain itself doesn't move.
//
// Cadence: one dispatch per PATROL_COOLDOWN turns. An "idle ally" is
// one without a current order — this naturally avoids stomping
// in-flight patrols (or any other captain command).
//
// See documents/v3_enemy_squad_design.md for the larger activity
// layer this fits into.
export default function patrolling(captain, player) {
    // First tick of the activity: dispatch immediately rather than
    // burning a full cooldown's worth of player moves of nothing.
    if (captain.activityState.patrolCooldown == null) {
        captain.activityState.patrolCooldown = 1
    }
    captain.activityState.patrolCooldown -= 1

    if (captain.activityState.patrolCooldown <= 0) {
        const allies = findAlliesInRange(captain, captain.commandRadius)
        const idleAlly = allies.find(a => !a.currentOrder)
        const target = idleAlly ? pickPatrolTarget(captain) : null
        if (idleAlly && target) {
            issueOrder(captain, [idleAlly], "go-to", true, {
                targetX: target.x,
                targetY: target.y,
                clearOnArrival: true
            })
            gameLog.log(`The ${captain.name} sends a patrol.`)
            captain.activityState.patrolCooldown = PATROL_COOLDOWN
        } else {
            // No eligible ally or no free tile — short retry rather
            // than a full cooldown so the activity stays responsive.
            captain.activityState.patrolCooldown = 2
        }
    }

    captain.movementPoints = 0
    captain.actionPoints = 0
}
