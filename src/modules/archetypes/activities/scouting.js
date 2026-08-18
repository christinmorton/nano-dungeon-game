import mapState from "../../MapState.js"
import gameLog from "../../GameLog.js"
import { findAlliesInRange, issueOrder } from "../captain.js"

const SCOUT_COOLDOWN = 5
const SCOUT_RADIUS = 12
const SCOUT_TILE_ATTEMPTS = 30

// Number of successful scout dispatches before the captain commits to
// claiming a region. Set low for arena verification — tune up once
// the procedural-generator integration lands and intel feeds into
// real "captain knows this floor" decisions.
const INTEL_THRESHOLD = 2
const CLAIM_REGION_RADIUS = 4
const CLAIM_CENTER_DISTANCE = 6
const CLAIM_TARGET_ATTEMPTS = 30

// Pick the rectangle the captain wants to claim. When the captain
// has a homeRoom, the claim aligns to that room — its tiles are
// already inside the captain's reachable area and the green visual
// matches the room boundary the player can see. Falls back to a
// free-floating square near the captain (arena-style) only when the
// captain has no room reference, which shouldn't happen in normal
// play but keeps the activity from wedging if it does.
function pickClaimTarget(captain) {
    if (captain.homeRoom) {
        const room = captain.homeRoom
        return { x: room.x, y: room.y, w: room.w, h: room.h }
    }
    const radius = CLAIM_REGION_RADIUS
    const maxY = mapState.level.length
    const maxX = mapState.level[0].length
    for (let i = 0; i < CLAIM_TARGET_ATTEMPTS; i++) {
        const angle = Math.random() * 2 * Math.PI
        const cx = Math.round(captain.x + Math.cos(angle) * CLAIM_CENTER_DISTANCE)
        const cy = Math.round(captain.y + Math.sin(angle) * CLAIM_CENTER_DISTANCE)
        if (cx < radius + 1 || cx >= maxX - radius - 1) continue
        if (cy < radius + 1 || cy >= maxY - radius - 1) continue
        if (!mapState.isWalkableTile(cx, cy)) continue
        return { x: cx - radius, y: cy - radius, w: radius * 2 + 1, h: radius * 2 + 1 }
    }
    return null
}

// Pick a walkable tile adjacent to the captain for the scout's
// return leg. The pathfinder treats the captain's exact tile as a
// wall (gridForEntity stamps all enemies as obstacles), so targeting
// captain.x/captain.y produces an empty path and the scout sits
// frozen. Stepping to an adjacent walkable tile gives the pathfinder
// a real destination and still reads as "returned to the captain."
// Returns null when the captain is fully surrounded — caller short-
// retries the cooldown in that case.
const RETURN_NEIGHBOR_OFFSETS = [
    [0, -1], [1, 0], [0, 1], [-1, 0],
    [1, -1], [1, 1], [-1, 1], [-1, -1]
]
function pickReturnTile(captain) {
    const maxY = mapState.level.length
    const maxX = mapState.level[0].length
    for (const [dx, dy] of RETURN_NEIGHBOR_OFFSETS) {
        const tx = captain.x + dx
        const ty = captain.y + dy
        if (tx < 0 || tx >= maxX || ty < 0 || ty >= maxY) continue
        if (mapState.isWalkableTile(tx, ty)) return { x: tx, y: ty }
    }
    return null
}

// Pick the scout's outbound tile. When the captain has a homeRoom,
// scouts stay inside it — pathfinder stamps closed doors as walls
// for non-Crafty enemies, so a cross-room scout target would just
// freeze the dispatched member. Falls back to a SCOUT_RADIUS-bounded
// random walkable tile around the captain (arena-style) otherwise.
function pickScoutTarget(captain) {
    if (captain.homeRoom) {
        const room = captain.homeRoom
        return mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
    }
    const maxY = mapState.level.length
    const maxX = mapState.level[0].length
    for (let i = 0; i < SCOUT_TILE_ATTEMPTS; i++) {
        const dx = Math.floor(Math.random() * (SCOUT_RADIUS * 2 + 1)) - SCOUT_RADIUS
        const dy = Math.floor(Math.random() * (SCOUT_RADIUS * 2 + 1)) - SCOUT_RADIUS
        if (dx === 0 && dy === 0) continue
        const tx = captain.x + dx
        const ty = captain.y + dy
        if (tx < 0 || tx >= maxX || ty < 0 || ty >= maxY) continue
        if (mapState.isWalkableTile(tx, ty)) return { x: tx, y: ty }
    }
    return null
}

// Scouting activity — captain dispatches an idle squad member on a
// long-range walk into unknown territory. Same dispatch shape as
// patrolling (issueOrder go-to with clearOnArrival) but a wider
// radius so scouts visibly leave the cluster, and a longer cooldown
// because each scout is a bigger commitment than a routine patrol
// sweep. Scouts don't yet return intel — the captain's "I've learned
// something about the dungeon" counter is deferred per the design
// doc until claim transitions are wired.
//
// The alternate model (captain spawns a dedicated scout entity vs
// dispatching existing members) is also deferred — see the Deferred
// section of documents/v3_enemy_squad_design.md.
// Look at every squad-ally within ALLY_SEARCH_RADIUS for any that
// were dispatched as scouts (marker set on dispatch) and have since
// completed their order AND made it back within commandRadius of the
// captain. Each qualifying ally counts as one intel return, the
// marker is cleared, and (if the captain is still unclaimed) the
// claim trigger checks the new total.
function harvestReturnedScouts(captain) {
    if (captain.claimState !== "unclaimed") return
    const allies = findAlliesInRange(captain, ALLY_SEARCH_RADIUS)
    let claimed = false
    for (const ally of allies) {
        if (!ally._scoutTripPending) continue
        if (ally.currentOrder) continue
        const dist = Math.max(
            Math.abs(ally.x - captain.x),
            Math.abs(ally.y - captain.y)
        )
        if (dist > captain.commandRadius) continue

        ally._scoutTripPending = false
        captain.activityState.intelCount = (captain.activityState.intelCount || 0) + 1
        gameLog.log(`A scout returns to the ${captain.name}.`)

        if (claimed) continue
        if (captain.activityState.intelCount < INTEL_THRESHOLD) continue
        const claimTarget = pickClaimTarget(captain)
        if (claimTarget) {
            captain.activityState = { claimTarget }
            captain.activity = "claiming"
            gameLog.log(`The ${captain.name} has chosen a place to claim.`)
            claimed = true
        } else {
            // Couldn't fit a region this tick — hold at threshold-1
            // so the very next return retries the pick.
            captain.activityState.intelCount = INTEL_THRESHOLD - 1
        }
    }
}

const ALLY_SEARCH_RADIUS = 24

export default function scouting(captain, player) {
    // Process returned scouts before considering a new dispatch — the
    // claim trigger lives here so it fires on actual intel rather
    // than on dispatch.
    harvestReturnedScouts(captain)

    // If the harvest flipped us into the claiming activity, the
    // captain archetype's next dispatch will route there; nothing
    // more to do this tick from scouting.
    if (captain.activity !== "scouting") {
        captain.movementPoints = 0
        captain.actionPoints = 0
        return
    }

    if (captain.activityState.scoutCooldown == null) {
        captain.activityState.scoutCooldown = 1
    }
    captain.activityState.scoutCooldown -= 1

    if (captain.activityState.scoutCooldown <= 0) {
        const allies = findAlliesInRange(captain, captain.commandRadius)
        const idleAlly = allies.find(a => !a.currentOrder)
        const target = idleAlly ? pickScoutTarget(captain) : null
        const returnTile = idleAlly && target ? pickReturnTile(captain) : null
        if (idleAlly && target && returnTile) {
            // Two-leg order: walk to the scout target, then walk back
            // to a tile adjacent to the captain. Targeting an
            // adjacent walkable tile (rather than captain.x/captain.y)
            // is what makes the return leg actually pathable — the
            // captain's own tile is stamped as an obstacle in the
            // pathfinder grid. arrivalRadius=1 is a tolerance hedge
            // in case another squad member ends up on the chosen
            // return tile before the scout arrives.
            issueOrder(captain, [idleAlly], "go-to", true, {
                targetX: target.x,
                targetY: target.y,
                returnTo: returnTile,
                arrivalRadius: 1,
                clearOnArrival: true
            })
            idleAlly._scoutTripPending = true
            gameLog.log(`The ${captain.name} sends a scout.`)
            captain.activityState.scoutCooldown = SCOUT_COOLDOWN
        } else {
            // No eligible ally, no free tile, or captain fully
            // surrounded (no walkable adjacent for the return leg).
            // Short retry so the activity doesn't burn a full
            // cooldown waiting on the situation to clear.
            captain.activityState.scoutCooldown = 2
        }
    }

    captain.movementPoints = 0
    captain.actionPoints = 0
}
