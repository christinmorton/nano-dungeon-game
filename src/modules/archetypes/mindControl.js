import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"

// Mind-control turn overrides — called from BaseEnemy.turn() right after the
// Stun/Rooted/flee checks, the same slot and pattern (no archetype-brain or
// captain/squad-AI edits). Returns true when it has CONSUMED the entity's turn,
// so the caller skips the normal archetype dispatch.
//
// CHARM is intentionally NOT handled here: it flips the unit's archetype to
// 'ally' (convertToAlly), so the ally brain runs it normally. This module
// covers the two overrides that change how a unit spends its OWN turn:
//   Fear    — stumble away from the player; can't act.
//   Confuse — stagger to a random adjacent tile; too addled to attack.
// Berserk's effect (attack/block stat swing + visual) lives in tags/berserk.js
// via statContribution; its indiscriminate "attack anything" targeting is still
// a TODO (needs a target-override in the brains).

export function mindControlTurn(enemy) {
    // Polymorphed-into-a-critter: harmless idle stumble, no attack (the form swap
    // itself lives in tags/transform.js). Reuses the confuse movement.
    if (enemy._transformHarmless) { confuseTurn(enemy); return true }
    const tags = enemy._tags || []
    if (tags.includes("Fear")) { fearTurn(enemy); return true }
    if (tags.includes("Confuse")) { confuseTurn(enemy); return true }
    return false
}

function fearTurn(enemy) {
    if (enemy.moving) return
    const player = dungeon.player
    if (enemy.movementPoints > 0 && player?.sprite) {
        const ax = Math.sign(enemy.x - player.x)
        const ay = Math.sign(enemy.y - player.y)
        // Prefer the away-diagonal, then the two away-cardinals (mirrors fleeStep).
        tryStep(enemy, [
            [enemy.x + ax, enemy.y + ay],
            [enemy.x + ax, enemy.y],
            [enemy.x, enemy.y + ay],
        ])
    }
    enemy.movementPoints = 0
    enemy.actionPoints = 0
}

function confuseTurn(enemy) {
    if (enemy.moving) return
    if (enemy.movementPoints > 0) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
        // Start the scan at a varying offset so the stumble isn't always the same
        // direction (no Math.random dependency on the first candidate's bias).
        const start = (enemy.x + enemy.y + (enemy._confuseTurns || 0)) % dirs.length
        const ordered = dirs.slice(start).concat(dirs.slice(0, start))
        tryStep(enemy, ordered.map(([dx, dy]) => [enemy.x + dx, enemy.y + dy]))
    }
    enemy.movementPoints = 0
    enemy.actionPoints = 0   // too confused to attack
}

// Take the first walkable, unoccupied candidate tile. Cornered = hold (no step).
function tryStep(enemy, candidates) {
    for (const [tx, ty] of candidates) {
        if (tx === enemy.x && ty === enemy.y) continue
        if (!mapState.isWalkableTile(tx, ty)) continue
        if (mapState.entityAtTile(tx, ty)) continue
        dungeon.stepEntityTo(enemy, tx, ty)
        return
    }
}
