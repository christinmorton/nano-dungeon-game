import PF from "pathfinding"
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"

// Shared helpers for archetype decision functions — order-driven
// targeting, idle ambient behavior, and the standard-order dispatcher
// that brute and skirmisher both delegate to. Will likely grow as
// more archetypes land; rename if scope expands beyond "archetype
// utilities".

// All 8 Chebyshev neighbor offsets.
const NEIGHBOR8 = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1]
]

// The tile an enemy should path TOWARD to reach its combat target. The hero is
// deliberately left walkable in gridForEntity (enemies plan straight to its tile
// and the final onto-the-hero step is rejected in stepEntityTo), so aim at it
// directly — keeps melee approach byte-identical to the pre-targeting AI. Every
// OTHER combatant (allies, summons, and enemies) is stamped as a solid wall, so
// a direct path to its tile is empty; aim instead at the nearest walkable tile
// adjacent to it (mirrors ally.js's approachTile and the captain's allies).
// Returns the target's own tile as a fallback when it has no open neighbor.
export function approachGoal(enemy, target) {
    if (target.type === "hero") return { x: target.x, y: target.y }
    let best = { x: target.x, y: target.y }
    let bestDist = Infinity
    for (const [dx, dy] of NEIGHBOR8) {
        const tx = target.x + dx
        const ty = target.y + dy
        if (!mapState.isWalkableTile(tx, ty)) continue
        const d = Math.max(Math.abs(enemy.x - tx), Math.abs(enemy.y - ty))
        if (d < bestDist) {
            bestDist = d
            best = { x: tx, y: ty }
        }
    }
    return best
}

// Pick a walkable tile adjacent to the player that isn't on the
// captain-to-player axis, so a flanking ally moves around rather than
// straight in. left/right doesn't enforce a strict orientation in v1;
// it just biases which side the search starts from so two allies with
// opposing flank orders pull to opposing sides.
export function flankTarget(player, leftSide) {
    const ordered = leftSide
        ? [[-1, 0], [0, -1], [-1, -1], [-1, 1], [1, 0], [0, 1], [1, 1], [1, -1]]
        : [[1, 0], [0, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [-1, -1], [-1, 1]]
    for (const [dx, dy] of ordered) {
        const tx = player.x + dx
        const ty = player.y + dy
        if (mapState.isWalkableTile(tx, ty)) return { x: tx, y: ty }
    }
    return null
}

// Pick a walkable tile adjacent to the captain on the captain-to-player
// axis. The body-block position for protect-me — ally stands between
// the captain and the threat.
export function protectMeTarget(captain, player) {
    const dx = Math.sign(player.x - captain.x)
    const dy = Math.sign(player.y - captain.y)
    const front = { x: captain.x + dx, y: captain.y + dy }
    if (mapState.isWalkableTile(front.x, front.y)) return front
    const adj = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0],           [1, 0],
        [-1, 1],  [0, 1],  [1, 1]
    ]
    for (const [adx, ady] of adj) {
        const t = { x: captain.x + adx, y: captain.y + ady }
        if (mapState.isWalkableTile(t.x, t.y)) return t
    }
    return null
}

// Pick a walkable tile adjacent to the player on the ally's own side.
// Each ally claiming "their side" of the player distributes the squad
// around the perimeter without any central coordination — natural
// box-in semantics from independent decisions.
export function boxInTarget(player, ally) {
    const dxSide = Math.sign(ally.x - player.x)
    const dySide = Math.sign(ally.y - player.y)
    const preferred = {
        x: player.x + (dxSide || 1),
        y: player.y + (dySide || 0)
    }
    if (mapState.isWalkableTile(preferred.x, preferred.y)) return preferred
    const adj = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
    for (const [adx, ady] of adj) {
        const t = { x: player.x + adx, y: player.y + ady }
        if (mapState.isWalkableTile(t.x, t.y)) return t
    }
    return null
}

// Ambient idle behavior — every 3-5 turns, step into a random walkable
// adjacent tile so the cluster doesn't look frozen between engagements.
// Archetype enemies don't get the legacy behavior-tag roll
// (hunter/patrolling/goingSomewhere), so this fills the gap. The
// internal cooldown is per-instance and lazily initialized; one
// successful step resets it.
export function tryIdleWander(enemy) {
    if (enemy._idleCooldown == null) {
        enemy._idleCooldown = 3 + Math.floor(Math.random() * 3)
    }
    enemy._idleCooldown -= 1
    if (enemy._idleCooldown > 0) return false

    const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    for (let i = offsets.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = offsets[i]
        offsets[i] = offsets[j]
        offsets[j] = tmp
    }
    for (const [dx, dy] of offsets) {
        const nx = enemy.x + dx
        const ny = enemy.y + dy
        if (mapState.isWalkableTile(nx, ny)) {
            dungeon.stepEntityTo(enemy, nx, ny)
            break
        }
    }
    enemy._idleCooldown = 3 + Math.floor(Math.random() * 3)
    return true
}

// Step one tile along a path to the target. Returns true if a step
// was taken. Used by command handlers below to avoid re-deriving the
// pathfinder boilerplate for each command.
function stepToward(enemy, targetX, targetY) {
    if (enemy.movementPoints <= 0) return false
    if (enemy.x === targetX && enemy.y === targetY) return false
    const grid = mapState.gridForEntity(enemy)
    const finder = new PF.AStarFinder()
    const path = finder.findPath(enemy.x, enemy.y, targetX, targetY, grid)
    if (path.length > 1) {
        dungeon.stepEntityTo(enemy, path[1][0], path[1][1])
        return true
    }
    return false
}

function threatenIfAdjacent(enemy, player, distance) {
    if (enemy.actionPoints > 0 && distance <= 2) {
        dungeon.attackEntity(enemy, player, enemy.weapon)
    }
}

// Handle the set of captain-issued orders that take the ally fully
// off its default behavior. Returns true if the order was handled
// (caller should early return); false otherwise (caller falls through
// to its archetype's default — usually path-to-player).
//
// Commands handled here: go-to, fall-back, protect-me, box-in, stall,
// defend. Commands NOT handled here: flank-left, flank-right — those
// just bias the path target and let the default movement+attack flow
// run, so the archetype handles them inline.
export function handleStandardOrder(enemy, order, player, distance) {
    if (!order) return false

    if (order.command === "go-to") {
        // arrivalRadius lets an order count as "arrived" when the
        // enemy is within N Chebyshev tiles of the target. Scouts
        // returning to the captain set this to 1 because the captain
        // tile itself is blocked in the pathfinding grid (all enemies
        // stamp as walls), so an exact-tile arrival is unreachable.
        // Formation/patrol orders default to 0 (exact match) so slot
        // pinning still requires the precise tile.
        const arrivalRadius = order.arrivalRadius || 0
        const dx = Math.abs(enemy.x - order.targetX)
        const dy = Math.abs(enemy.y - order.targetY)
        const arrived = Math.max(dx, dy) <= arrivalRadius
        // Two-leg orders carry a returnTo field — on reaching the
        // outbound tile, swap the target to returnTo and walk back.
        // The field gets nulled so the second arrival doesn't loop.
        // Then clearOnArrival fires at the end of the return leg,
        // releasing the ally to idle wander near the captain.
        // Formation slot orders omit both flags and stay pinned.
        if (arrived && order.returnTo) {
            order.targetX = order.returnTo.x
            order.targetY = order.returnTo.y
            order.returnTo = null
        } else if (arrived && order.clearOnArrival) {
            enemy.currentOrder = null
            enemy.movementPoints = 0
            enemy.actionPoints = 0
            return true
        }
        stepToward(enemy, order.targetX, order.targetY)
        threatenIfAdjacent(enemy, player, distance)
        enemy.movementPoints = 0
        enemy.actionPoints = 0
        return true
    }

    if (order.command === "fall-back") {
        if (enemy.movementPoints > 0) {
            const retreatX = enemy.x - Math.sign(player.x - enemy.x)
            const retreatY = enemy.y - Math.sign(player.y - enemy.y)
            if (mapState.isWalkableTile(retreatX, retreatY)) {
                dungeon.stepEntityTo(enemy, retreatX, retreatY)
            }
            enemy.movementPoints -= 1
        }
        enemy.actionPoints = 0
        enemy.consumeOrder()
        return true
    }

    if (order.command === "protect-me") {
        const captain = order.source
        const target = captain ? protectMeTarget(captain, player) : null
        if (target) stepToward(enemy, target.x, target.y)
        threatenIfAdjacent(enemy, player, distance)
        enemy.movementPoints = 0
        enemy.actionPoints = 0
        return true
    }

    if (order.command === "box-in") {
        const target = boxInTarget(player, enemy)
        if (target) stepToward(enemy, target.x, target.y)
        threatenIfAdjacent(enemy, player, distance)
        enemy.movementPoints = 0
        enemy.actionPoints = 0
        return true
    }

    if (order.command === "stall") {
        // Hold position, threaten only — "buys time for the rest of
        // the squad to get into formation" per the spec.
        threatenIfAdjacent(enemy, player, distance)
        enemy.movementPoints = 0
        enemy.actionPoints = 0
        return true
    }

    if (order.command === "defend") {
        // Defensive posture: step toward player every *other* tick
        // (reduced movement per spec). The protection() override on
        // BaseEnemy adds the damage-reduction half.
        enemy._defendSkip = !enemy._defendSkip
        if (!enemy._defendSkip) {
            stepToward(enemy, player.x, player.y)
        }
        threatenIfAdjacent(enemy, player, distance)
        enemy.movementPoints = 0
        enemy.actionPoints = 0
        return true
    }

    return false
}
