import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import Follower from "./Follower.js"

// The `summon` verb. Lives here (a sibling of Follower), NOT in
// abilities/universals.js: universals is imported very broadly and early, so
// pulling the heavy Follower → BaseEnemy chain into it loaded BaseEnemy before
// its class was defined (a circular-import TDZ). Follower already imports
// Dungeon safely, so this module mirrors that load profile.
//
// Composes the follower component: spawns a Follower under `caster`, optionally
// TEMPORARY (lifespan turns → auto-fades via BaseEnemy.refresh) and CAPPED (max
// concurrent of a summonKind under the caster). Summon SPELLS pass the unit's
// identity (name, stats, hp, art, tint, weaponName), so a Stone Golem and a
// Spirit Wolf come out different. Returns the follower, or null when the tile is
// blocked.
export function summon(caster, opts = {}) {
    const { tile, lifespan = null, cap = null, summonKind = null, ...followerOpts } = opts
    if (!tile || !mapState.isWalkableTile(tile.x, tile.y)) return null

    // Cap: keep at most `cap` of this kind alive under the caster. At the limit,
    // retire the oldest so re-casting relocates the summon rather than stacking.
    if (cap != null && summonKind && Array.isArray(caster.party)) {
        const active = caster.party.filter(a => a._summonKind === summonKind)
        while (active.length >= cap) {
            const oldest = active.shift()
            // Drop from the roster explicitly so the count is right immediately,
            // then tear it down (removeEntity's onDestroy also leaves the party,
            // but this guarantees the cap holds regardless of that path).
            const i = caster.party.indexOf(oldest)
            if (i >= 0) caster.party.splice(i, 1)
            dungeon.removeEntity(oldest)
        }
    }

    // The `summon` verb CONJURES — its products are CONSTRUCTS by default
    // (mindless, non-containable, time/resource-limited; encyclopedia §6.5). A pet
    // is the exception and passes bondType:'pet' to override (see companions/pet.js).
    const follower = new Follower(tile.x, tile.y, {
        leader: caster,
        owner: caster,
        ...followerOpts,
        bondType: followerOpts.bondType ?? 'construct',
    })
    follower._summonKind = summonKind
    if (lifespan != null) follower._summonTurns = lifespan
    return follower
}
