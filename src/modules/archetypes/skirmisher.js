import PF from "pathfinding"
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import { flankTarget, tryIdleWander, handleStandardOrder, approachGoal } from "./orderBias.js"
import { combatTargetFor } from "../Targeting.js"

// Light melee with hit-and-run reflex when wounded. High DEX/SPD,
// modest STR, fragile CON.

function turn(enemy) {
    if (enemy.moving) return

    const player = dungeon.player
    enemy.updatePerception(player)

    const order = enemy._readCurrentOrder()

    // Captain orders that fully override default behavior are handled
    // in orderBias.handleStandardOrder and fire whether or not the
    // enemy is engaged — patrol / scout / claim dispatches need to
    // work when the player is far away. flank-left/right and the
    // intrinsic low-HP hit-and-run fall through to the engaged-only
    // path below. Squad coordination stays player-anchored (captain
    // migration deferred), so feed these player + player-distance.
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

    // Fight the seam-selected target — the player, or a nearer / taunting
    // player-team unit (ally, summon).
    let target = combatTargetFor(enemy) || player
    const dx = target.x - enemy.x
    const dy = target.y - enemy.y
    const distance = Math.max(Math.abs(dx), Math.abs(dy))

    const lowHp = enemy.healthPoints < (enemy.maxHealthPoints / 2)

    // Hit-and-run: when wounded and adjacent, swing once then back off from
    // whatever it's fighting.
    if (lowHp && distance <= 2) {
        if (enemy.actionPoints > 0) {
            dungeon.attackEntity(enemy, target, enemy.weapon)
            enemy.actionPoints -= 1
        }
        if (enemy.movementPoints > 0) {
            const retreatX = enemy.x - Math.sign(dx)
            const retreatY = enemy.y - Math.sign(dy)
            if (mapState.isWalkableTile(retreatX, retreatY)) {
                dungeon.stepEntityTo(enemy, retreatX, retreatY)
            }
            enemy.movementPoints -= 1
        }
        if (order) enemy.consumeOrder()
        return
    }

    const goal = approachGoal(enemy, target)
    let targetX = goal.x
    let targetY = goal.y
    // Flank keeps the skirmisher oriented on the PLAYER (captain maneuver).
    if (order && (order.command === "flank-left" || order.command === "flank-right")) {
        const flank = flankTarget(player, order.command === "flank-left")
        if (flank) {
            targetX = flank.x
            targetY = flank.y
            target = player
        }
    }

    // Pre-move strike distance to the final target (matches the original
    // move-then-swing-on-prior-distance cadence).
    const strikeDist = Math.max(Math.abs(target.x - enemy.x), Math.abs(target.y - enemy.y))

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
        if (strikeDist <= 2) {
            dungeon.attackEntity(enemy, target, enemy.weapon)
        }
        enemy.actionPoints -= 1
    }

    if (order) enemy.consumeOrder()
}

export default {
    turn,
    // Morale break: below 30% HP a skirmisher abandons the fight entirely
    // (full flee), one tier past its in-combat hit-and-run at 50%.
    fleeThreshold: 0.3,
    statTemplate: {
        STR: [8, 11],
        DEX: [13, 15],
        CON: [6, 9],
        SPD: [12, 15],
        INT: [5, 8],
        Magic: [3, 6]
    },
    hpFormula: (s) => 25 + s.CON * 5
}

