import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import { tryIdleWander, handleStandardOrder } from "./orderBias.js"
import { combatTargetFor } from "../Targeting.js"

// Shambler — mindless undead melee (the void ghoul / skeleton identity). The
// anti-brute: no tactics. It does NOT pathfind cleverly and does NOT flank or
// coordinate — it just lurches one tile toward the player every turn and swings
// on contact. The result is a head-on pile that hangs up on corners and each
// other (the "dumb zombie" feel) instead of the brute's surround-and-kill.
//
// Combat-tactics orders (flank / advance) are simply not honored — there's no
// flank handling here — so a captain can't make shamblers maneuver. Non-combat
// standard orders (claim / patrol / go-to) still pass through handleStandardOrder
// so settlement positioning works. See documents/v3_darkness_settlements.md.

// One tile toward (tx, ty): try the diagonal, then the dominant axis, then the
// other axis; give up (shamble in place) if all are blocked. No rerouting —
// that's the point. Skips tiles blocked by terrain or another body.
function canShambleTo(nx, ny) {
    if (!mapState.isWalkableTile(nx, ny)) return false
    const at = mapState.entityAtTile(nx, ny)
    if (at && (at.type === "hero" || at.type === "enemy")) return false
    return true
}

function shambleToward(enemy, tx, ty) {
    const sx = Math.sign(tx - enemy.x)
    const sy = Math.sign(ty - enemy.y)
    const candidates = []
    if (sx !== 0 && sy !== 0) candidates.push([enemy.x + sx, enemy.y + sy])
    if (Math.abs(tx - enemy.x) >= Math.abs(ty - enemy.y)) {
        if (sx !== 0) candidates.push([enemy.x + sx, enemy.y])
        if (sy !== 0) candidates.push([enemy.x, enemy.y + sy])
    } else {
        if (sy !== 0) candidates.push([enemy.x, enemy.y + sy])
        if (sx !== 0) candidates.push([enemy.x + sx, enemy.y])
    }
    for (const [nx, ny] of candidates) {
        if (canShambleTo(nx, ny)) {
            dungeon.stepEntityTo(enemy, nx, ny)
            return
        }
    }
    // All blocked — the shambler just lurches in place this turn.
}

function turn(enemy) {
    if (enemy.moving) return

    const player = dungeon.player
    enemy.updatePerception(player)

    const order = enemy._readCurrentOrder()

    // Non-combat standard orders (go-to / patrol / claim / defend) still apply so
    // the settlement can position the band; combat-tactics orders are ignored.
    // Settlement positioning is player-anchored, so feed player + player-distance.
    const playerDistance = Math.max(Math.abs(player.x - enemy.x), Math.abs(player.y - enemy.y))
    if (handleStandardOrder(enemy, order, player, playerDistance)) return

    if (!enemy.isEngaged()) {
        tryIdleWander(enemy)
        enemy.movementPoints = 0
        enemy.actionPoints = 0
        return
    }

    // Lurch at the seam-selected target — the player, or a nearer / taunting
    // player-team unit. shambleToward walks toward the tile and hangs up on
    // contact (no pathfinding — that's the point), so it needs no approach tile.
    const target = combatTargetFor(enemy) || player
    const distance = Math.max(Math.abs(target.x - enemy.x), Math.abs(target.y - enemy.y))

    if (enemy.movementPoints > 0) {
        shambleToward(enemy, target.x, target.y)
        enemy.movementPoints -= 1
    }

    if (enemy.actionPoints > 0) {
        if (distance <= 2) dungeon.attackEntity(enemy, target, enemy.weapon)
        enemy.actionPoints -= 1
    }

    if (order) enemy.consumeOrder()
}

export default {
    turn,
    // Slow + durable: shamblers trade the brute's reach/speed for staying power.
    statTemplate: {
        STR: [11, 14],
        DEX: [2, 4],
        CON: [14, 16],
        SPD: [2, 4],
        INT: [1, 3],
        Magic: [1, 3]
    },
    hpFormula: (s) => 50 + s.CON * 8
}
