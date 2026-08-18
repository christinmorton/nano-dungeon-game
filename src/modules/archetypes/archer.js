import PF from "pathfinding"
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import { tryIdleWander, handleStandardOrder, approachGoal } from "./orderBias.js"
import { combatTargetFor } from "../Targeting.js"

// Turns of reload after a shot before the archer can fire again.
// Without this gate the archer shoots every round it has AP, which at
// the bow's effective range gives it many more landed attacks than a
// melee enemy can produce while the player closes — feels lopsided.
// Tune up for slower archers, down to 0 for snipers.
const RELOAD_TURNS = 1

// All 8 Chebyshev neighbors. Used by pickRetreatTile to find the
// walkable adjacent tile that maximizes distance from the player.
const NEIGHBOR_OFFSETS = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1]
]

// Pick the walkable neighbor of `enemy` that's farthest from `target`.
// Falls back to null when fully surrounded by allies/walls. Smarter
// than "step directly opposite the target" because squad members
// commonly block the literal opposite tile in a tight cluster.
function pickRetreatTile(enemy, target) {
    let best = null
    let bestDist = -Infinity
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
        const tx = enemy.x + dx
        const ty = enemy.y + dy
        if (!mapState.isWalkableTile(tx, ty)) continue
        if (mapState.blockingStructureAt(tx, ty, enemy)) continue   // sprite-less walls
        const dist = Math.max(Math.abs(target.x - tx), Math.abs(target.y - ty))
        if (dist > bestDist) {
            bestDist = dist
            best = { x: tx, y: ty }
        }
    }
    return best
}

// Step one tile along the shortest path toward the target (the "close the gap"
// move, shared by the too-far and shot-blocked branches). approachGoal aims at
// the hero's tile (walkable) or an open tile beside a wall-stamped ally/summon.
function stepTowardTarget(enemy, target) {
    const goal = approachGoal(enemy, target)
    const grid = mapState.gridForEntity(enemy)
    const finder = new PF.AStarFinder()
    const path = finder.findPath(enemy.x, enemy.y, goal.x, goal.y, grid)
    if (path.length > 2) dungeon.stepEntityTo(enemy, path[1][0], path[1][1])
}

// A wall is in the lane — sidestep to re-acquire the shot. Pick the walkable
// neighbor that's still in the weapon's range band AND has a clear projectile
// path to the target, preferring the one farthest from the target (stay safe).
// Null if no neighbor restores a shot (caller falls back to closing in).
function pickShotTile(enemy, target, magic) {
    const minR = enemy.weapon.minRange()
    const maxR = enemy.weapon.range()
    let best = null
    let bestDist = -Infinity
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
        const tx = enemy.x + dx
        const ty = enemy.y + dy
        if (!mapState.isWalkableTile(tx, ty)) continue
        if (mapState.blockingStructureAt(tx, ty, enemy)) continue   // don't sidestep onto a wall
        const d = Math.max(Math.abs(target.x - tx), Math.abs(target.y - ty))
        if (d < minR || d > maxR) continue
        if (!mapState.hasProjectilePath({ x: tx, y: ty }, target, enemy, magic)) continue
        if (d > bestDist) { bestDist = d; best = { x: tx, y: ty } }
    }
    return best
}

// Kiting AI for ranged squad members (archers AND casters — casters reuse this
// archetype with a spell weapon). Reads weapon.range() / minRange() for the
// preferred shooting band, then:
//   - shoots if the player is in the band, reload is ready, AND the projectile
//     has a clear flight path (terrain + walls occlude shots — see
//     WorldQueries.hasProjectilePath; a force/ice wall stops the lane)
//   - sidesteps to re-acquire the line if a wall blocks the shot
//   - backs off one tile if the player is too close
//   - paths toward the player if the player is too far
// Ranged kiter. High DEX, modest SPD, fragile.

function turn(enemy) {
    if (enemy.moving) return

    const player = dungeon.player
    enemy.updatePerception(player)

    const order = enemy._readCurrentOrder()

    // Captain orders position the squad relative to the player and are unchanged
    // by the targeting migration (captain coordination is player-anchored for
    // now). flank-left/right and advance/focus-player fall through to the
    // engaged-only kiting logic below.
    const playerDistance = Math.max(Math.abs(player.x - enemy.x), Math.abs(player.y - enemy.y))
    if (handleStandardOrder(enemy, order, player, playerDistance)) return

    if (!enemy.isEngaged()) {
        tryIdleWander(enemy)
        enemy.movementPoints = 0
        enemy.actionPoints = 0
        return
    }

    // Shoot the seam-selected target — the player, or a nearer / taunting
    // player-team unit (ally, summon).
    const target = combatTargetFor(enemy) || player
    const distance = Math.max(Math.abs(target.x - enemy.x), Math.abs(target.y - enemy.y))

    const weapon = enemy.weapon
    const maxR = weapon.range()
    const minR = weapon.minRange()
    const inShootingBand = distance >= minR && distance <= maxR
    // Spell weapons (the caster role's fireball scroll) are magic projectiles —
    // only an arcane wall stops them; arrows are physical, stopped by any solid
    // wall. A blocked lane means no shot lands, so the archer must reposition.
    const magicShot = !!(weapon.damageType && weapon.damageType !== 'physical')
    const clearShot = inShootingBand && mapState.hasProjectilePath(enemy, target, enemy, magicShot)

    // Always decrement AP if it's available, whether or not the shot
    // actually fires. Otherwise an archer with the target inside minRange
    // can't shoot, leaves AP=1 forever, and over() never returns true —
    // which deadlocks the round refresh.
    if (enemy.actionPoints > 0) {
        const reloadReady = !enemy._reloadRemaining || enemy._reloadRemaining <= 0
        if (clearShot && reloadReady) {
            dungeon.attackEntity(enemy, target, weapon)
            enemy._reloadRemaining = RELOAD_TURNS
        } else if (enemy._reloadRemaining > 0) {
            enemy._reloadRemaining -= 1
        }
        enemy.actionPoints -= 1
    }

    if (enemy.movementPoints > 0) {
        if (distance < minR) {
            const retreat = pickRetreatTile(enemy, target)
            if (retreat) {
                dungeon.stepEntityTo(enemy, retreat.x, retreat.y)
            }
        } else if (distance > maxR) {
            stepTowardTarget(enemy, target)
        } else if (!clearShot) {
            // In range but a wall blocks the lane — sidestep to recover the shot,
            // else close in to find an angle around it.
            const reposition = pickShotTile(enemy, target, magicShot)
            if (reposition) dungeon.stepEntityTo(enemy, reposition.x, reposition.y)
            else stepTowardTarget(enemy, target)
        }
        enemy.movementPoints -= 1
    }

    if (order) enemy.consumeOrder()
}

export default {
    turn,
    // Fragile kiter: breaks and runs at 30% HP rather than be cornered.
    fleeThreshold: 0.3,
    statTemplate: {
        STR: [6, 9],
        DEX: [13, 15],
        CON: [6, 9],
        SPD: [8, 12],
        INT: [6, 9],
        Magic: [3, 6]
    },
    hpFormula: (s) => 20 + s.CON * 5
}

