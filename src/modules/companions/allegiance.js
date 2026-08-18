// Flip an existing entity's allegiance to the leader's side, IN PLACE — the
// shared mechanic behind taming a wild beast (permanent) and future
// charm/convert (temporary). The entity keeps its art, stats and kind; it just
// starts following and fighting for `leader` via the ally archetype.
//
// This is the proof that the follower system is general: a follower is ANY
// entity with team "player" + archetype "ally" + a leader, not only the
// Follower class. The shared ally behaviors (ally-paced isEngaged, suppressed
// vision cone, no-loot/party-leaving death) live on BaseEnemy keyed on
// team/archetype, so a converted enemy behaves exactly like a summoned Follower.

export function convertToAlly(entity, leader) {
    // Leave its old battle roster cleanly (mirrors fleeing.js's exit) before we
    // null the reference, so the encounter manager doesn't keep counting it.
    if (entity.battle && entity.battle.roster) entity.battle.roster.delete(entity)

    entity.team = "player"
    entity.type = "ally"          // enemy-only systems (alerts, encounters, wall-stamp) skip it
    entity.archetype = "ally"     // BaseEnemy.turn() now dispatches the ally brain
    entity.leader = leader
    entity.owner = leader

    // Drop stale enemy combat state so it doesn't pursue the player or act on a
    // dead order.
    entity.battle = null
    entity.squad = null
    entity.alerted = false
    entity.fleeing = false
    entity.freeForAll = false
    entity.currentOrder = null

    // Join the leader's party roster (deduped; BaseEnemy.onDestroy removes it).
    if (leader && Array.isArray(leader.party) && !leader.party.includes(entity)) {
        leader.party.push(entity)
    }

    return entity
}

// Capture the allegiance identity needed to undo a TEMPORARY conversion (charm).
// Only the side/role fields — NOT the volatile combat state (battle/squad), which
// goes stale while the unit fights for the other side; revert resets that fresh.
export function snapshotAllegiance(entity) {
    return { team: entity.team, type: entity.type, archetype: entity.archetype }
}

// Undo convertToAlly: restore the original side/role from a snapshot and reset
// combat state to "awake and hostile" (rather than restoring a possibly-ended
// battle/squad). The expiry/cleanse path for temporary charm/convert.
export function revertAllegiance(entity, snapshot = {}) {
    // Leave the (former) leader's party cleanly first.
    if (entity.leader && Array.isArray(entity.leader.party)) {
        const i = entity.leader.party.indexOf(entity)
        if (i >= 0) entity.leader.party.splice(i, 1)
    }
    entity.team = snapshot.team ?? "monster"
    entity.type = snapshot.type ?? "enemy"
    entity.archetype = snapshot.archetype ?? "brute"
    entity.leader = null
    entity.owner = null
    entity.battle = null
    entity.squad = null
    entity.fleeing = false
    entity.freeForAll = false
    entity.currentOrder = null
    entity.alerted = true        // wakes back up hostile toward the player
    return entity
}
