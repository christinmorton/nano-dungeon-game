import PF from 'pathfinding'
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import gameLog from "../GameLog.js"
import { combatTargetFor } from "../Targeting.js"
import { approachGoal } from "./orderBias.js"

// Guard-like AI. Walks a route between spawn point and a random target
// tile, flipping direction on arrival. Aggros when perception trips.
// Methodical pace — SPD is low-mid.
//
// Migrated from tags/patrolling.js (2026-05-25). The initialize hook
// that captured spawn point + rolled the destination is now lazy-init
// at the top of turn() (state lives on the enemy, not the archetype).

const PATROL_TINT = 0xdd00cd

function lazyInit(enemy) {
    if (enemy._patrolInitialized) return
    enemy._patrolInitialized = true

    enemy.tint = PATROL_TINT
    if (enemy.sprite) {
        enemy.sprite.tint = PATROL_TINT
        enemy.sprite.tintFill = false
    }

    enemy._initialX = enemy.x
    enemy._initialY = enemy.y

    const randomCoords = mapState.randomWalkableTile()
    enemy._destinationX = randomCoords.x
    enemy._destinationY = randomCoords.y
    enemy._targetX = enemy._destinationX
    enemy._targetY = enemy._destinationY
}

function turn(enemy) {
    lazyInit(enemy)

    if (enemy.moving) return

    const player = dungeon.player
    enemy.updatePerception(player)

    if (enemy.alerted) {
        gameLog.log(`${enemy.name} raaawwrr!!!`)
    }

    let oldX = enemy.x
    let oldY = enemy.y
    let targetX, targetY
    // The thing being chased while alerted (the player, or a nearer / taunting
    // player-team unit via the seam); null while patrolling. Drives the attack.
    let chaseTarget = null

    if (enemy.alerted) {
        // Chase the combat target; patrol route preserved for when we de-alert.
        // approachGoal aims at the hero's tile directly (walkable) or an open tile
        // beside a wall-stamped ally/summon.
        chaseTarget = combatTargetFor(enemy) || player
        const goal = approachGoal(enemy, chaseTarget)
        targetX = goal.x
        targetY = goal.y
    } else {
        if (oldX == enemy._initialX && oldY == enemy._initialY) {
            enemy._targetX = enemy._destinationX
            enemy._targetY = enemy._destinationY
        }
        if (oldX == enemy._destinationX && oldY == enemy._destinationY) {
            enemy._targetX = enemy._initialX
            enemy._targetY = enemy._initialY
        }
        targetX = enemy._targetX
        targetY = enemy._targetY

        // A stealth break (BaseEnemy.updatePerception nulls _destination when
        // the target vanishes into Invisible/Underground) can leave the patrol
        // route without an endpoint, which then copies null into _targetX here.
        // Re-roll a fresh destination rather than pathfinding to a null tile —
        // PF.getNodeAt has no bounds check and hard-crashes on it. Mirrors the
        // same guard goingSomewhere already does for its wander destination.
        if (targetX == null || targetY == null) {
            const dest = mapState.randomWalkableTile()
            enemy._destinationX = dest.x
            enemy._destinationY = dest.y
            enemy._targetX = dest.x
            enemy._targetY = dest.y
            targetX = dest.x
            targetY = dest.y
        }
    }

    let grid = mapState.gridForEntity(enemy)
    let finder = new PF.AStarFinder()
    let path = finder.findPath(oldX, oldY, targetX, targetY, grid)

    if (path.length === 0) {
        const fallback = mapState.findPathToRandomReachable(enemy)
        if (fallback) {
            path = fallback.path
            enemy._destinationX = fallback.destX
            enemy._destinationY = fallback.destY
            enemy._targetX = fallback.destX
            enemy._targetY = fallback.destY
        }
    }

    if (enemy.movementPoints > 0) {
        if (path.length > 1) {
            dungeon.stepEntityTo(enemy, path[1][0], path[1][1])
        }
        enemy.movementPoints -= 1
    }

    if (enemy.actionPoints > 0) {
        if (chaseTarget && mapState.distanceBetweenEntities(enemy, chaseTarget) <= 2) {
            dungeon.attackEntity(enemy, chaseTarget, enemy.weapon)
        }
        enemy.actionPoints -= 1
    }
}

export default {
    turn,
    // Designated lookout — sees farther and through a wider arc than the
    // BaseEnemy default (3 / 60), and its facing sweeps as it walks its route,
    // so it's the archetype most likely to spot the player "by luck".
    perception: { radius: 5, coneDegrees: 90 },
    statTemplate: {
        STR: [8, 12],
        DEX: [6, 10],
        CON: [8, 12],
        SPD: [5, 8],
        INT: [5, 8],
        Magic: [3, 6]
    },
    hpFormula: (s) => 25 + s.CON * 5
}
