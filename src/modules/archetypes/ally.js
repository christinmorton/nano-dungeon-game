import PF from "pathfinding"
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import { targetFor, cheby } from "../Targeting.js"
import { ALLY_COMMANDS, clearCommand } from "../companions/commands.js"

// Ally archetype — Slice 1 of the follower system (2026-06-10).
//
// The per-turn brain for a Follower (companions/Follower.js): if a hostile is
// near the leader, close and attack it; otherwise trail the leader, staying
// inside LEASH. Mirrors brute's move-then-swing shape, but the target comes
// from the targeting seam (targetFor) instead of a hard-coded dungeon.player,
// and the fallback is "follow the leader" rather than "idle wander."
//
// Deliberately minimal: one move + one attack per round, no formation slotting
// or hit-and-run yet — that follow/leash ruleset polish is Slice 2.

// A foe must be within this many tiles of the LEADER for the ally to engage it
// — the follower is a bodyguard, fighting threats to whoever it guards, not a
// hound that chases anything it senses across the map. Exported for reuse.
export const GUARD_RADIUS = 6

// Hard leash: the ally never strays farther than this from the leader. Past it
// it abandons any foe and returns home — the backstop against wandering off.
const LEASH_MAX = 8

// When not fighting, hold position within this many tiles of the leader and
// only close the gap when farther. Small enough to read as "following", large
// enough not to jitter on every single step the hero takes.
const FOLLOW_HOLD = 2

function stepToward(ally, tx, ty) {
    if (ally.movementPoints <= 0) return false
    if (ally.x === tx && ally.y === ty) return false
    const grid = mapState.gridForEntity(ally)
    const finder = new PF.AStarFinder()
    const path = finder.findPath(ally.x, ally.y, tx, ty, grid)
    if (path.length > 1) {
        dungeon.stepEntityTo(ally, path[1][0], path[1][1])
        return true
    }
    return false
}

// Nearest walkable tile adjacent to the foe. A foe's own tile is stamped as a
// wall in gridForEntity (it's an enemy), so the ally can't path onto it — it
// approaches an open neighbor instead, exactly like a captain's allies do.
function approachTile(ally, foe) {
    const offsets = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0],           [1, 0],
        [-1, 1],  [0, 1],  [1, 1]
    ]
    let best = null
    let bestDist = Infinity
    for (const [dx, dy] of offsets) {
        const tx = foe.x + dx
        const ty = foe.y + dy
        if (!mapState.isWalkableTile(tx, ty)) continue
        const d = Math.max(Math.abs(ally.x - tx), Math.abs(ally.y - ty))
        if (d < bestDist) {
            bestDist = d
            best = { x: tx, y: ty }
        }
    }
    return best
}

function engage(ally, foe) {
    // Already adjacent — swing.
    if (cheby(ally, foe) <= 1) {
        if (ally.actionPoints > 0) dungeon.attackEntity(ally, foe, ally.weapon)
        return
    }
    // Close the gap toward an open tile beside the foe...
    if (ally.movementPoints > 0) {
        const approach = approachTile(ally, foe)
        if (approach) stepToward(ally, approach.x, approach.y)
    }
    // ...and swing if that step landed us adjacent.
    if (cheby(ally, foe) <= 1 && ally.actionPoints > 0) {
        dungeon.attackEntity(ally, foe, ally.weapon)
    }
}

// The foe this ally should actually fight right now, or null — the bodyguard
// leash in one place. A hostile qualifies only when it is within GUARD_RADIUS of
// the LEADER (a threat to who we guard, NOT merely near the ally), is in line of
// sight (no charging down a corridor after something sensed through a wall —
// targetFor itself is LOS-blind), and only while the ally is still on its leash.
// Shared by turn() and Follower.isEngaged() so "engaged" and "actually fighting"
// never disagree. Named guardTargetFor (not combatTargetFor) to distinguish it
// from Targeting.combatTargetFor, the enemy-side seam call: this is the ally's
// LEASHED selection — guard-radius + leash + line-of-sight on top of the seam's
// taunt-aware targetFor (which it now inherits via that call).
export function guardTargetFor(ally) {
    const leader = ally.leader || dungeon.player
    if (!leader) return null
    if (cheby(ally, leader) > LEASH_MAX) return null
    const foe = targetFor(ally)
    if (!foe) return null
    if (cheby(foe, leader) > GUARD_RADIUS) return null
    if (!mapState.hasLineOfSight(ally, foe)) return null
    return foe
}

// Per-turn dispatch. An ally acts on its STANDING COMMAND (companions/commands.js,
// set by a party leader or member); with no command it defaults to FOLLOW — the
// original bodyguard behavior, byte-for-byte. Decoys short-circuit (inert).
function turn(ally) {
    if (ally.moving) return

    // Decoys are inert: a summoned copy that only soaks hits / splits enemy
    // targeting. It neither fights nor follows — just stands and ends its turn.
    if (ally._decoy) {
        ally.movementPoints = 0
        ally.actionPoints = 0
        return
    }

    const cmd = ally.allyCommand || { type: ALLY_COMMANDS.FOLLOW }
    switch (cmd.type) {
        case ALLY_COMMANDS.STAY:        return holdAndDefend(ally)
        case ALLY_COMMANDS.ATTACK:      return attackOrder(ally, cmd)
        case ALLY_COMMANDS.GUARD:       return guardOrder(ally, cmd)
        case ALLY_COMMANDS.PASSIVE:     return followLeader(ally)        // hold fire
        case ALLY_COMMANDS.AGGRESSIVE:  return aggressiveOrder(ally)
        case ALLY_COMMANDS.RECALL:      return recallOrder(ally)
        case ALLY_COMMANDS.USE_ABILITY: return useAbilityOrder(ally, cmd)
        case ALLY_COMMANDS.FOLLOW:
        default:                        return followAndGuard(ally)
    }
}

// FOLLOW (default) — fight a leashed threat to the leader, else trail the leader.
// This is the original Slice-1 behavior, factored in two so the other commands
// can reuse the follow half.
function followAndGuard(ally) {
    const foe = guardTargetFor(ally)
    if (foe) {
        engage(ally, foe)
        ally.movementPoints = 0
        ally.actionPoints = 0
        return
    }
    followLeader(ally)
}

// Trail the leader, never attacking — the movement half of FOLLOW, and the whole
// of PASSIVE (hold fire). Aims at the LEADER's tile (left walkable in
// gridForEntity); FOLLOW_HOLD stops the approach at 2 tiles and stepEntityTo
// blocks the final step onto the hero, so it tucks in behind. The MP decrement
// runs even when blocked so the ally still reaches over().
function followLeader(ally) {
    const leader = ally.leader || dungeon.player
    ally.actionPoints = 0
    if (!leader || cheby(ally, leader) <= FOLLOW_HOLD) {
        ally.movementPoints = 0
        return
    }
    if (ally.movementPoints > 0) {
        stepToward(ally, leader.x, leader.y)
        ally.movementPoints -= 1
    }
}

// STAY — hold this tile; only strike a foe that comes adjacent (a stationary
// defender). Never gives chase.
function holdAndDefend(ally) {
    const foe = guardTargetFor(ally)
    if (foe && cheby(ally, foe) <= 1 && ally.actionPoints > 0) {
        dungeon.attackEntity(ally, foe, ally.weapon)
    }
    ally.movementPoints = 0
    ally.actionPoints = 0
}

// ATTACK { target } — focus-fire the ordered target (engage closes + swings).
// Drops the order and reverts to FOLLOW once the target dies/vanishes or the ally
// is pulled off its leash.
function attackOrder(ally, cmd) {
    const target = cmd.target
    const leader = ally.leader || dungeon.player
    if (!target || !target.sprite || (leader && cheby(ally, leader) > LEASH_MAX)) {
        clearCommand(ally)
        return followAndGuard(ally)
    }
    engage(ally, target)
    ally.movementPoints = 0
    ally.actionPoints = 0
}

// GUARD { tile } — hold a position and fight foes near it (a sentry on a spot
// rather than on the leader). Moves to the tile when away from it.
function guardOrder(ally, cmd) {
    const tile = cmd.tile
    if (!tile) return followAndGuard(ally)
    const foe = targetFor(ally)
    if (foe && cheby(foe, tile) <= GUARD_RADIUS && mapState.hasLineOfSight(ally, foe)) {
        engage(ally, foe)
    } else if (cheby(ally, tile) > 0 && ally.movementPoints > 0) {
        stepToward(ally, tile.x, tile.y)
    }
    ally.movementPoints = 0
    ally.actionPoints = 0
}

// AGGRESSIVE — hunt ANY enemy within leash (not just leader-threats); fall back
// to following when there's nothing to hit.
function aggressiveOrder(ally) {
    const leader = ally.leader || dungeon.player
    if (leader && cheby(ally, leader) <= LEASH_MAX) {
        const foe = targetFor(ally)
        if (foe && cheby(ally, foe) <= LEASH_MAX && mapState.hasLineOfSight(ally, foe)) {
            engage(ally, foe)
            ally.movementPoints = 0
            ally.actionPoints = 0
            return
        }
    }
    followLeader(ally)
}

// RECALL — one-shot: return to the leader's side, then clear the order so the
// ally resumes its default FOLLOW.
function recallOrder(ally) {
    const leader = ally.leader || dungeon.player
    ally.actionPoints = 0
    if (!leader || cheby(ally, leader) <= FOLLOW_HOLD) {
        clearCommand(ally)
        ally.movementPoints = 0
        return
    }
    if (ally.movementPoints > 0) {
        stepToward(ally, leader.x, leader.y)
        ally.movementPoints -= 1
    }
}

// USE_ABILITY { ability, target } — fire a pet ability on this turn, then clear
// the one-shot order. Best-effort: the ally must carry the ability instance (in
// ally.abilities) or the order is passed the instance directly; otherwise it's a
// no-op. The target is shaped like the hero dispatch's resolved target.
function useAbilityOrder(ally, cmd) {
    const ability = resolveAllyAbility(ally, cmd.ability)
    if (ability && (typeof ability.canActivate !== "function" || ability.canActivate())) {
        ability.activate(ally, { entity: cmd.target, tile: cmd.tile, hero: ally, dx: 0, dy: 0 })
    }
    clearCommand(ally)
    ally.movementPoints = 0
    ally.actionPoints = 0
}

function resolveAllyAbility(ally, ability) {
    if (!ability) return null
    if (typeof ability === "object" && typeof ability.activate === "function") return ability
    const list = ally.abilities || []
    return list.find(a => a === ability || a.name === ability || a.constructor?.name === ability) || null
}

export default {
    turn
}
