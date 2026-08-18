import PF from "pathfinding"
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import { flankTarget, tryIdleWander, handleStandardOrder, approachGoal } from "./orderBias.js"
import { combatTargetFor } from "../Targeting.js"

// Heavy melee. Pathfinds straight at its combat target and swings on contact.
// High STR/CON, low everything else; tanky and slow.

function turn(enemy) {
    if (enemy.moving) return

    const player = dungeon.player
    enemy.updatePerception(player)

    const order = enemy._readCurrentOrder()

    // Captain orders that fully override default behavior (go-to,
    // fall-back, protect-me, box-in, stall, defend) are handled in
    // orderBias.handleStandardOrder and fire whether or not the
    // enemy is engaged — patrol / scout / claim dispatches need to
    // work when the player is far away. flank-left/right and
    // advance/focus-player fall through and are processed below in
    // the engaged-only path because they're combat orders. Squad
    // coordination stays player-anchored (captain migration deferred),
    // so feed these the player + player-distance, unchanged.
    const playerDistance = Math.max(Math.abs(player.x - enemy.x), Math.abs(player.y - enemy.y))
    if (handleStandardOrder(enemy, order, player, playerDistance)) return

    // Idle (not yet alerted, no standard order): drift one tile every
    // few turns so the cluster doesn't look frozen between
    // engagements, then zero the turn's points so the round can end.
    // Without zeroing, an unalerted enemy holds MP/AP > 0 forever
    // and tm.over() never returns true.
    if (!enemy.isEngaged()) {
        tryIdleWander(enemy)
        enemy.movementPoints = 0
        enemy.actionPoints = 0
        return
    }

    // Fight the target the seam picks — the player by default, or a nearer /
    // taunting player-team unit (ally, summon). Path to its approach tile (the
    // hero is walkable, others are wall-stamped — approachGoal handles both).
    let target = combatTargetFor(enemy) || player
    const goal = approachGoal(enemy, target)
    let targetX = goal.x
    let targetY = goal.y
    // A flank order keeps the brute oriented on the PLAYER (captain maneuver),
    // pathing to the flank tile and striking the player on contact.
    if (order && (order.command === "flank-left" || order.command === "flank-right")) {
        const flank = flankTarget(player, order.command === "flank-left")
        if (flank) {
            targetX = flank.x
            targetY = flank.y
            target = player
        }
    }

    const distance = Math.max(Math.abs(target.x - enemy.x), Math.abs(target.y - enemy.y))

    const grid = mapState.gridForEntity(enemy)
    const finder = new PF.AStarFinder()
    const path = finder.findPath(enemy.x, enemy.y, targetX, targetY, grid)

    if (enemy.movementPoints > 0) {
        if (path.length > 2) {
            dungeon.stepEntityTo(enemy, path[1][0], path[1][1])
        }
        enemy.movementPoints -= 1
    }

    if (enemy.actionPoints > 0) {
        if (distance <= 2) {
            dungeon.attackEntity(enemy, target, enemy.weapon)
        }
        enemy.actionPoints -= 1
    }

    if (order) enemy.consumeOrder()
}

export default {
    turn,
    statTemplate: {
        STR: [13, 15],
        DEX: [3, 6],
        CON: [13, 15],
        SPD: [3, 6],
        INT: [3, 6],
        Magic: [3, 6]
    },
    hpFormula: (s) => 40 + s.CON * 8
}

