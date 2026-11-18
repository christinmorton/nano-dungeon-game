import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import gameLog from "../GameLog.js"
import archetypes from "./index.js"
import { combatTargetFor } from "../Targeting.js"

// Enemy side of universal flee. Distinct from skirmisher's in-combat
// hit-and-run (which stays engaged): this is a MORALE BREAK — the enemy
// abandons the fight entirely and runs for open space. Triggered when a
// committed enemy drops below its archetype's fleeThreshold (absent = never
// flees, so brutes/captains hold). See documents/v3_objective_driven_encounters.md.
//
// updateFlee(enemy) is called from BaseEnemy.turn BEFORE the archetype
// dispatch; it returns true when it has taken the enemy's turn (the caller
// then skips the archetype). Leaving the battle drops the enemy from its
// roster and clears enemy.battle, so isEngaged() goes false and the arena
// clamp in Dungeon.stepEntityTo no longer fences it in — it can cross the
// ring. Once clear of the player it stops fleeing and reverts to its
// archetype's loose (idle) behavior; the encounter manager won't re-recruit
// a fleeing enemy (it skips e.fleeing), so it isn't yanked back mid-run.

// Chebyshev tiles from the player past which a fleer has "broken contact"
// and goes loose (the arena radius is 5, so this clears the ring with margin).
const SAFE_DISTANCE = 9

export function updateFlee(enemy) {
    if (!enemy.fleeing && shouldStartFleeing(enemy)) {
        beginFlee(enemy)
    }
    if (!enemy.fleeing) return false
    // Mid-tween: hold the turn (don't issue a second step), but keep it owned
    // so the archetype doesn't run while we're fleeing.
    if (enemy.moving) return true

    // Run from the nearest threat the seam reports (the player, or a closer
    // ally/summon), not always the player — a fleer breaks from whatever is
    // actually chasing it. Falls back to the player when no hostile is left.
    const threat = combatTargetFor(enemy) || dungeon.player
    const distance = threat && threat.sprite
        ? Math.max(Math.abs(enemy.x - threat.x), Math.abs(enemy.y - threat.y))
        : Infinity
    if (distance >= SAFE_DISTANCE) {
        // Broke contact — stop fleeing and hand the turn back to the archetype
        // (which, now that the enemy is loose, runs its idle behavior).
        enemy.fleeing = false
        return false
    }

    // Respect Rooted (movementPoints zeroed) — a rooted fleer holds in place.
    if (enemy.movementPoints > 0) fleeStep(enemy, threat)
    enemy.movementPoints = 0
    enemy.actionPoints = 0
    return true
}

function shouldStartFleeing(enemy) {
    if (!enemy.isEngaged()) return false
    const threshold = archetypes[enemy.archetype]?.fleeThreshold
    if (!threshold) return false
    return enemy.healthPoints <= enemy.maxHealthPoints * threshold
}

function beginFlee(enemy) {
    enemy.fleeing = true
    if (enemy.battle) {
        enemy.battle.roster.delete(enemy)
        enemy.battle = null
    }
    gameLog.log(`The ${enemy.name} flees!`)
}

// Step one tile away from the threat. Prefers the away-diagonal, then the two
// away-cardinals, taking the first walkable, unoccupied tile. Cornered (no
// away-tile this turn) it holds — which is how a pursuer catches a fleer.
function fleeStep(enemy, threat) {
    const ax = Math.sign(enemy.x - threat.x)
    const ay = Math.sign(enemy.y - threat.y)
    const candidates = [
        [enemy.x + ax, enemy.y + ay],
        [enemy.x + ax, enemy.y],
        [enemy.x, enemy.y + ay]
    ]
    for (const [tx, ty] of candidates) {
        if (tx === enemy.x && ty === enemy.y) continue
        if (!mapState.isWalkableTile(tx, ty)) continue
        if (mapState.entityAtTile(tx, ty)) continue
        dungeon.stepEntityTo(enemy, tx, ty)
        return
    }
}
