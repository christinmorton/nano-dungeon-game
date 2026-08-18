import tm from "./TurnManager.js"

// Targeting seam — the single place that answers "who is <entity>'s enemy?".
//
// Allegiance is expressed by entity.team ("player" | "monster"). Started as
// Slice 1 of the follower system (2026-06-10) — nearest hostile by Chebyshev,
// nothing more — and grew taunt-awareness in the targeting-system build
// (2026-06-20): every combatant (allies AND enemies) now selects its combat
// target through here, so a Taunt marker on a player-team unit can pull enemies
// off a squishier teammate.
//
// Two public selectors, layered:
//   targetFor(entity)       — the core pick: a forcing taunter if one covers the
//                             entity, else the nearest hostile. Used by allies
//                             (via ally.js's guard wrapper) and enemies alike.
//   combatTargetFor(enemy)  — the enemy call site: targetFor() today, but a
//                             stable seam for future threat tables / sticky-
//                             target hysteresis without touching the archetypes.
//
// Still the ONLY seam: do not scatter `team` comparisons or `dungeon.player`
// combat-target reads across the AI. Threat accumulation, line-of-sight
// priority, and hysteresis remain future extensions of targetFor's guts.

export function cheby(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

// Is `other` a valid combat target for `entity`? A live combatant on the
// opposing team. Entities without a team (items, doors, containers, walls) are
// never targets; phased/dead entities are skipped.
export function isHostile(entity, other) {
    if (other === entity) return false
    if (!entity.team || !other.team) return false
    // "neutral" is a true third stance: a neutral entity fights no one and is
    // fought by no one (a pact-offerer standing to bargain, not to brawl) until
    // it's flipped to a real side (convertToAlly / revertAllegiance).
    if (entity.team === "neutral" || other.team === "neutral") return false
    if (other.team === entity.team) return false
    if (other.healthPoints == null || other.healthPoints <= 0) return false
    if (other.phased) return false
    return true
}

// Every live hostile of `entity`, unordered.
export function hostilesOf(entity) {
    const out = []
    for (const other of tm.entities) {
        if (isHostile(entity, other)) out.push(other)
    }
    return out
}

// The nearest hostile actively TAUNTING `entity`, or null. A taunter is a live
// hostile carrying the "Taunt" marker (tags/taunt.js) whose taunt radius covers
// `entity`. v1 is a HARD FORCE: a covered combatant attacks the taunter over its
// otherwise-nearest pick. Among multiple taunters in range, the nearest wins.
function tauntTargetFor(entity) {
    let best = null
    let bestDist = Infinity
    for (const other of hostilesOf(entity)) {
        if (!other._tags || !other._tags.includes("Taunt")) continue
        const d = cheby(entity, other)
        if (d > (other._tauntRadius ?? 0)) continue
        if (d < bestDist) {
            bestDist = d
            best = other
        }
    }
    return best
}

// The target `entity` should fight: a taunter forcing it (if any), else the
// nearest hostile. null if no hostile exists. The whole core seam in one call —
// this is what the AI asks for instead of hard-coding dungeon.player.
export function targetFor(entity) {
    const taunter = tauntTargetFor(entity)
    if (taunter) return taunter

    let best = null
    let bestDist = Infinity
    for (const other of hostilesOf(entity)) {
        const d = cheby(entity, other)
        if (d < bestDist) {
            bestDist = d
            best = other
        }
    }
    return best
}

// The enemy-side combat target — who an enemy archetype approaches / paths to /
// attacks this turn. Today it's just targetFor(enemy) (taunt-aware nearest
// hostile); it exists as a SEPARATE, stable call site so the enemy AI asks ONE
// thing and a later threat-table / sticky-target pass can land here without
// editing every archetype. Distinct from ally.js's guardTargetFor, which adds
// the bodyguard leash + line-of-sight gate on top of this.
export function combatTargetFor(enemy) {
    return targetFor(enemy)
}
