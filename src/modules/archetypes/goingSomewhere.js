import PF from 'pathfinding'
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import gameLog from "../GameLog.js"
import { combatTargetFor } from "../Targeting.js"
import { approachGoal } from "./orderBias.js"

// Wanderer — picks a random walkable tile, walks to it, picks another.
// Aggros to the player when perception trips, locking destination to
// the player while alerted. Modest in everything.
//
// Migrated from tags/goingsomewhere.js (2026-05-25). State setup is
// lazy-init in turn() since archetypes have no initialize hook.

const WANDER_TINT = 0xdd0000

function lazyInit(enemy) {
    if (enemy._wanderInitialized) return
    enemy._wanderInitialized = true

    enemy.tint = WANDER_TINT
    if (enemy.sprite) {
        enemy.sprite.tint = WANDER_TINT
        enemy.sprite.tintFill = false
    }
}

function turn(enemy) {
    lazyInit(enemy)

    if (enemy.moving) return

    const player = dungeon.player
    enemy.updatePerception(player)

    if (enemy.alerted) {
        gameLog.log(`${enemy.name} grrrr!!!`)
    }

    let oldX = enemy.x
    let oldY = enemy.y
    let dX, dY
    // The thing being chased while alerted (the player, or a nearer / taunting
    // player-team unit via the seam); null while wandering. Drives the attack.
    let chaseTarget = null

    if (enemy.alerted) {
        // Lock the destination onto the combat target. approachGoal aims at the
        // hero directly (walkable) or an open tile beside a wall-stamped
        // ally/summon, so the cached destination is always pathable.
        chaseTarget = combatTargetFor(enemy) || player
        const goal = approachGoal(enemy, chaseTarget)
        enemy._destinationX = goal.x
        enemy._destinationY = goal.y
        dX = goal.x
        dY = goal.y
    } else {
        dX = enemy._destinationX
        dY = enemy._destinationY

        if (!dX || !dY) {
            const randomCoords = mapState.randomWalkableTile()
            enemy._destinationX = randomCoords.x
            enemy._destinationY = randomCoords.y
            dX = enemy._destinationX
            dY = enemy._destinationY
        }

        if (oldX == dX && oldY == dY) {
            const randomCoords = mapState.randomWalkableTile()
            enemy._destinationX = randomCoords.x
            enemy._destinationY = randomCoords.y
            dX = enemy._destinationX
            dY = enemy._destinationY
        }
    }

    let grid = mapState.gridForEntity(enemy)
    let finder = new PF.AStarFinder()
    let path = finder.findPath(oldX, oldY, dX, dY, grid)

    if (path.length === 0) {
        const fallback = mapState.findPathToRandomReachable(enemy)
        if (fallback) {
            path = fallback.path
            enemy._destinationX = fallback.destX
            enemy._destinationY = fallback.destY
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
    statTemplate: {
        STR: [6, 10],
        DEX: [6, 10],
        CON: [8, 12],
        SPD: [6, 10],
        INT: [5, 8],
        Magic: [3, 6]
    },
    hpFormula: (s) => 25 + s.CON * 5
}
