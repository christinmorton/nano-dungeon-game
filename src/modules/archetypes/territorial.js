import PF from 'pathfinding'
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"

// Return-home handler for territorial-stance enemies (§16 Stage 2). A general
// gate (not a per-enemy script): when a territorial enemy is NOT alerted/engaged
// and has drifted out of its home zone, it heads back toward the zone instead of
// roaming the floor. Called from BaseEnemy.turn() in the pre-dispatch pipeline
// (same slot as flee / mind-control); returns true if it took the turn, so the
// archetype's own movement is skipped this tick.
//
// The zone is the enemy's spawnRoom (or homeRoom). Full airtight "can't leave"
// confinement is roam scope = zone (§16 Stage 3); this just walks a strayed
// territorial guard back where it belongs.
export function territorialReturnTurn(enemy) {
    if (enemy.stance !== "territorial") return false
    if (enemy.alerted || enemy.isEngaged()) return false
    const zone = enemy.homeRoom || enemy.spawnRoom
    if (!zone) return false

    const inZone = enemy.x >= zone.x && enemy.x < zone.x + zone.w
        && enemy.y >= zone.y && enemy.y < zone.y + zone.h
    if (inZone) return false        // already home — let the archetype idle within it
    if (enemy.moving) return true   // mid-step; consume the turn

    // Aim at a walkable tile inside the zone (fresh each turn is fine — we only
    // need to converge back INTO the room, the inZone check ends the return).
    const t = mapState.randomWalkableTileInRoom(zone.x, zone.y, zone.w, zone.h)
    const tx = t ? t.x : Math.floor(zone.x + zone.w / 2)
    const ty = t ? t.y : Math.floor(zone.y + zone.h / 2)
    const path = new PF.AStarFinder().findPath(enemy.x, enemy.y, tx, ty, mapState.gridForEntity(enemy))
    if (enemy.movementPoints > 0) {
        if (path.length > 1) dungeon.stepEntityTo(enemy, path[1][0], path[1][1])
        enemy.movementPoints -= 1
    }
    enemy.actionPoints = 0
    return true
}
