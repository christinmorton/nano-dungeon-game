import PF from 'pathfinding'
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import { combatTargetFor } from "../Targeting.js"
import { detects } from "../Perception.js"
import { approachGoal } from "./orderBias.js"
import gameLog from "../GameLog.js"
import { hunterDebugOn } from "../debugFlags.js"

// The hunter is a targeted pursuer that puts on an act. Instead of beelining
// the shortest path the instant it spawns, it runs a three-stage hunt:
//
//   travel  -> head to the hero's last-known area (seeded at spawn / refreshed
//              whenever it actually sees the hero)
//   search  -> reaching that area empty, check a few nearby rooms one at a
//              time
//   close   -> drop the act and beeline to the hero's true position
//
// LOS-accel: seeing the hero at any non-close stage jumps straight to `close`.
// So breaking line of sight / distance buys time. The one behavioral fork is
// what happens when the search budget runs out WITHOUT reacquiring the hero:
//   - relentless (bounty/zealot): close in anyway — inevitable, always catches
//   - tracker    (assassin/stalker): lose the trail, drop to a wander, and can
//                reacquire later if the hero reappears — evadable
// `huntPersistence` can be authored onto an enemy later; absent, it rolls at
// spawn. See documents/v3_ai_behavior_system.md (Hunter).
//
// High SPD shapes the identity; STR/CON are average. Migrated from
// tags/hunter.js (2026-05-25); reworked from a pure beeline 2026-07-12.

const HUNTER_TINT = 0xe3e3e3
const HUNT_SIGHT_RADIUS = 7   // omnidirectional scan (still needs line of sight)
const SEARCH_ROOMS = 3        // rooms checked before the persistence branch fires

function lazyInit(enemy) {
    if (enemy._hunterInitialized) return
    enemy._hunterInitialized = true
    enemy.alerted = true
    enemy.tint = HUNTER_TINT
    if (enemy.sprite) enemy.sprite.tint = HUNTER_TINT

    // v3 rolled a hunter ROLE (assassin / stalker / bounty / zealot) from
    // dialog/hunterBarks.js, which supplied both its bark lines and a default
    // persistence. The barks go with the rest of the dialog layer, but PERSISTENCE
    // is real behaviour — it gates whether a hunter keeps tracking after losing
    // you. v3's four roles split exactly two "tracker" and two "relentless", so
    // the same 50/50 is rolled directly here and the variety survives the cut.
    enemy.huntPersistence = enemy.huntPersistence || (Math.random() < 0.5 ? "tracker" : "relentless")

    const p = dungeon.player
    enemy._huntAnchorX = p ? p.x : enemy.x
    enemy._huntAnchorY = p ? p.y : enemy.y
    enemy._huntStage = "travel"
    enemy._huntChecked = []
    enemy._huntRoomsChecked = 0
    narrate(enemy, `hunting you — ${enemy.huntPersistence}, travel to last-known (${enemy._huntAnchorX},${enemy._huntAnchorY})`)
}

// Debug-only narration of the hunt to the game log, so the whole travel ->
// search -> close arc is followable without chasing the hunter through fog.
// Gated by the hunter debug switch (debugFlags.js); silent in normal play.
function narrate(enemy, msg) {
    if (hunterDebugOn()) gameLog.log(`[hunt] ${enemy.name} (${enemy.x},${enemy.y}): ${msg}`)
}

// End the turn without moving (used on stage-transition ticks). Zeroing the
// points is required so over() returns true and the round can end.
function spend(enemy) {
    enemy.movementPoints = 0
    enemy.actionPoints = 0
}

function enemyInRoom(enemy, room) {
    return !!room
        && enemy.x >= room.x && enemy.x < room.x + room.w
        && enemy.y >= room.y && enemy.y < room.y + room.h
}

function markChecked(enemy, room) {
    if (room && !enemy._huntChecked.includes(room)) enemy._huntChecked.push(room)
}

// Nearest room the hunter hasn't checked yet (by center Chebyshev distance).
function pickNextSearchRoom(enemy) {
    if (!mapState.rooms) return null
    let best = null, bestD = Infinity
    for (const r of mapState.rooms) {
        if (enemy._huntChecked.includes(r)) continue
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2
        const d = Math.max(Math.abs(cx - enemy.x), Math.abs(cy - enemy.y))
        if (d < bestD) { bestD = d; best = r }
    }
    return best
}

// A* one step toward a tile; no attack (searching doesn't fight). Falls back to
// a random reachable tile so a blocked/void target never freezes the hunter.
function moveToward(enemy, tx, ty) {
    let path = new PF.AStarFinder().findPath(enemy.x, enemy.y, tx, ty, mapState.gridForEntity(enemy))
    if (path.length === 0) {
        const fb = mapState.findPathToRandomReachable(enemy)
        if (fb) path = fb.path
    }
    if (enemy.movementPoints > 0) {
        if (path.length > 1) dungeon.stepEntityTo(enemy, path[1][0], path[1][1])
        enemy.movementPoints -= 1
    }
    enemy.actionPoints = 0
}

// Search budget spent — branch on persistence.
function finishSearch(enemy) {
    if (enemy.huntPersistence === "tracker") {
        enemy._huntStage = "lost"
        enemy.alerted = false
        narrate(enemy, "budget spent, no trail — giving up, wandering (tracker)")
    } else {
        enemy._huntStage = "close"
        narrate(enemy, "budget spent — closing in on your true position (relentless)")
    }
}

function huntTravel(enemy) {
    const ax = enemy._huntAnchorX, ay = enemy._huntAnchorY
    const anchorRoom = (ax != null) ? mapState.roomAt(ax, ay) : null
    const arrived = ax == null || (enemy.x === ax && enemy.y === ay) || enemyInRoom(enemy, anchorRoom)
    if (arrived) {
        // Reached the last-known area and the hero isn't in sight (else the
        // top-of-turn check would have flipped us to `close`). Search outward.
        markChecked(enemy, anchorRoom)
        narrate(enemy, "reached last-known area — empty, searching outward")
        const next = pickNextSearchRoom(enemy)
        if (!next) { finishSearch(enemy); return spend(enemy) }
        enemy._huntSearchRoom = next
        enemy._huntStage = "search"
        return spend(enemy)
    }
    moveToward(enemy, ax, ay)
}

function huntSearch(enemy) {
    const room = enemy._huntSearchRoom
    if (!enemyInRoom(enemy, room)) { moveToward(enemy, ...roomTile(room, enemy)); return }
    // Reached a search room; it's empty (else we'd be closing). Bark, count it,
    // and move on — or run out the budget and branch.
    markChecked(enemy, room)
    enemy._huntRoomsChecked += 1
    narrate(enemy, `searched a room (${enemy._huntRoomsChecked}/${SEARCH_ROOMS}) — empty`)
    if (enemy._huntRoomsChecked >= SEARCH_ROOMS) { finishSearch(enemy); return spend(enemy) }
    const next = pickNextSearchRoom(enemy)
    if (!next) { finishSearch(enemy); return spend(enemy) }
    enemy._huntSearchRoom = next
    spend(enemy)
}

// A walkable tile inside a room (fallback: the room's top-left) as [x, y].
function roomTile(room, enemy) {
    if (!room) return [enemy.x, enemy.y]
    const t = mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
    return t ? [t.x, t.y] : [room.x, room.y]
}

// Tracker gave up the trail — wander like a prowler. The top-of-turn sight
// check can still snap it back to `close` if the hero reappears.
function huntLost(enemy) {
    let dX = enemy._destinationX, dY = enemy._destinationY
    if (!dX || !dY || (enemy.x === dX && enemy.y === dY)) {
        const c = mapState.randomWalkableTile()
        enemy._destinationX = dX = c.x
        enemy._destinationY = dY = c.y
    }
    let path = new PF.AStarFinder().findPath(enemy.x, enemy.y, dX, dY, mapState.gridForEntity(enemy))
    if (path.length === 0) {
        const fb = mapState.findPathToRandomReachable(enemy)
        if (fb) { path = fb.path; enemy._destinationX = fb.destX; enemy._destinationY = fb.destY }
    }
    if (enemy.movementPoints > 0) {
        if (path.length > 1) dungeon.stepEntityTo(enemy, path[1][0], path[1][1])
        enemy.movementPoints -= 1
    }
    enemy.actionPoints = 0
}

// The act is over: beeline to the true position and swing on contact. This is
// the original hunter behavior. Hidden (Invisible/Underground) heroes can't be
// tracked live — hold instead of chasing an omniscient ghost.
function huntClose(enemy, player, stealthed) {
    if (stealthed) { spend(enemy); return }
    const target = combatTargetFor(enemy) || player
    const goal = approachGoal(enemy, target)
    let path = new PF.AStarFinder().findPath(enemy.x, enemy.y, goal.x, goal.y, mapState.gridForEntity(enemy))
    const reachable = path.length > 0
    if (!reachable) {
        const fb = mapState.findPathToRandomReachable(enemy)
        if (fb) path = fb.path
    }
    if (enemy.movementPoints > 0) {
        if (path.length > (reachable ? 2 : 1)) dungeon.stepEntityTo(enemy, path[1][0], path[1][1])
        enemy.movementPoints -= 1
    }
    if (enemy.actionPoints > 0) {
        if (mapState.distanceBetweenEntities(enemy, target) <= 2) {
            dungeon.attackEntity(enemy, target, enemy.weapon)
        }
        enemy.actionPoints -= 1
    }
}

function turn(enemy) {
    lazyInit(enemy)

    // Skip while a previous move tween is in flight (stacked tweens decouple
    // the sprite from logical (x, y)).
    if (enemy.moving) return

    const player = dungeon.player
    if (!player) { spend(enemy); return }

    const stealthed = player._tags?.includes("Invisible") || player._tags?.includes("Underground")

    // LOS-accel / reacquire: actually seeing the hero (omni scan + line of
    // sight; stealth blocks it via canSee) refreshes the anchor and drops the
    // act. Once closing, stay closing.
    if (detects(enemy, player, HUNT_SIGHT_RADIUS)) {
        enemy._huntAnchorX = player.x
        enemy._huntAnchorY = player.y
        if (enemy._huntStage !== "close") {
            enemy._huntStage = "close"
            enemy.alerted = true
            narrate(enemy, "spotted you — dropping the act, closing in")
        }
    }

    switch (enemy._huntStage) {
        case "travel": return huntTravel(enemy)
        case "search": return huntSearch(enemy)
        case "lost":   return huntLost(enemy)
        case "close":
        default:       return huntClose(enemy, player, stealthed)
    }
}

export default {
    turn,
    statTemplate: {
        STR: [8, 12],
        DEX: [8, 12],
        CON: [8, 12],
        SPD: [12, 15],
        INT: [5, 8],
        Magic: [3, 6]
    },
    hpFormula: (s) => 25 + s.CON * 6
}
