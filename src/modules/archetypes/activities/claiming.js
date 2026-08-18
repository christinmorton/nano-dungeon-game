import PF from "pathfinding"
import dungeon from "../../Dungeon.js"
import mapState from "../../MapState.js"
import gameLog from "../../GameLog.js"
import { findAlliesInRange, issueOrder } from "../captain.js"

const REGION_ASSIGNMENT_ATTEMPTS = 20
// Allies should be sought across a wider radius than commandRadius
// because they may have walked off on patrol/scout dispatches before
// the claim was triggered. Picking the smaller of commandRadius*3 and
// the room's far corner is good enough for the arena scale.
const ALLY_SEARCH_RADIUS = 24

// Geometric center of the target rectangle. Captain walks here as
// part of the convergence; "captain at center" is one of the two
// finalize conditions.
function regionCenter(target) {
    return {
        x: Math.floor(target.x + target.w / 2),
        y: Math.floor(target.y + target.h / 2)
    }
}

// Pick a walkable tile inside the target rectangle. Bounds-checks
// before isWalkableTile because the rectangle can include map-edge
// tiles (its underlying getTileAt returns null off-map).
function pickRegionTile(target, occupied) {
    const maxY = mapState.level.length
    const maxX = mapState.level[0].length
    for (let i = 0; i < REGION_ASSIGNMENT_ATTEMPTS; i++) {
        const tx = target.x + Math.floor(Math.random() * target.w)
        const ty = target.y + Math.floor(Math.random() * target.h)
        if (tx < 0 || tx >= maxX || ty < 0 || ty >= maxY) continue
        const key = `${tx},${ty}`
        if (occupied.has(key)) continue
        if (!mapState.isWalkableTile(tx, ty)) continue
        occupied.add(key)
        return { x: tx, y: ty }
    }
    return null
}

function isInsideRegion(entity, target) {
    return entity.x >= target.x && entity.x < target.x + target.w
        && entity.y >= target.y && entity.y < target.y + target.h
}

function stepCaptainToward(captain, targetX, targetY) {
    if (captain.movementPoints <= 0) return
    if (captain.x === targetX && captain.y === targetY) return
    const grid = mapState.gridForEntity(captain)
    const finder = new PF.AStarFinder()
    const path = finder.findPath(captain.x, captain.y, targetX, targetY, grid)
    if (path.length > 1) {
        dungeon.stepEntityTo(captain, path[1][0], path[1][1])
    }
}

function createClaimMarker(captain) {
    if (!captain.sprite) return
    const scene = captain.sprite.scene
    const region = captain.claimRegion
    const TILE = 16
    captain.claimMarker = scene.add.rectangle(
        region.x * TILE,
        region.y * TILE,
        region.w * TILE,
        region.h * TILE,
        0x4ade80,
        0.12
    )
        .setOrigin(0)
        .setStrokeStyle(2, 0x4ade80, 0.65)
        .setDepth(1)
}

function finalizeClaim(captain, target) {
    captain.claimState = "claimed"
    captain.claimRegion = { x: target.x, y: target.y, w: target.w, h: target.h }

    // Release the pinned go-to orders we issued during claiming so
    // squad members can patrol freely within the new territory.
    const allies = findAlliesInRange(captain, ALLY_SEARCH_RADIUS)
    for (const ally of allies) {
        if (ally.currentOrder && ally.currentOrder.source === captain) {
            ally.currentOrder = null
        }
    }

    createClaimMarker(captain)
    gameLog.log(`The ${captain.name} claims this ground!`)

    captain.activityState = {}
    captain.activity = "patrolling"
}

// Claiming activity — the intermediate state between unclaimed and
// claimed. Captain has chosen a target region (set by scouting when
// the intel threshold is met) as a {x, y, w, h} rectangle and is
// moving the whole band into position. On entry, the captain assigns
// each living squad member a pinned go-to tile inside the rectangle
// and starts walking toward the center itself. Each tick re-checks
// position — once the captain is at center AND every ally is inside
// the rectangle, the claim finalizes (visual rectangle, state flip,
// activity → patrolling).
//
// Pinned orders (no clearOnArrival) keep allies from drifting out
// before the captain arrives at center. Dead allies drop naturally
// from the check because findAlliesInRange only iterates the live
// entity set.
//
// See documents/v3_enemy_squad_design.md for the surrounding spec.
export default function claiming(captain, player) {
    const target = captain.activityState.claimTarget
    if (!target) {
        // Defensive — shouldn't reach here. Bail to idle behavior so
        // the captain doesn't lock up if the trigger was malformed.
        captain.movementPoints = 0
        captain.actionPoints = 0
        return
    }

    const center = regionCenter(target)

    // First tick: assign each ally a tile inside the region. Pinned
    // orders (no clearOnArrival) so they don't drift out before the
    // captain arrives at center.
    if (!captain.activityState.assignmentsIssued) {
        const allies = findAlliesInRange(captain, ALLY_SEARCH_RADIUS)
        const occupied = new Set([`${center.x},${center.y}`])
        for (const ally of allies) {
            const tile = pickRegionTile(target, occupied)
            if (!tile) continue
            issueOrder(captain, [ally], "go-to", true, {
                targetX: tile.x,
                targetY: tile.y
            })
        }
        captain.activityState.assignmentsIssued = true
        gameLog.log(`The ${captain.name} moves to claim ground.`)
    }

    stepCaptainToward(captain, center.x, center.y)

    const captainAtCenter = captain.x === center.x && captain.y === center.y
    const allies = findAlliesInRange(captain, ALLY_SEARCH_RADIUS)
    const allInside = allies.length > 0 && allies.every(a => isInsideRegion(a, target))

    if (captainAtCenter && allInside) {
        finalizeClaim(captain, target)
    }

    captain.movementPoints = 0
    captain.actionPoints = 0
}
