import { summon } from "./summon.js"

// Decoy — a non-acting copy of the caster (a clone / illusion) that soaks hits
// and splits enemy targeting. Built on the `summon` verb: it's a Follower on
// your team, but flagged `_decoy` so the ally brain (archetypes/ally.js) leaves
// it standing — it neither fights nor follows. The lighter, available-now cousin
// of true acting clones (those just need the normal ally brain + the follower
// system, which exists). Mirrors the caster's look for the clone fantasy; cap /
// lifespan behave like summon. Requires opts.tile (a walkable tile).
export function decoy(caster, opts = {}) {
    const unit = summon(caster, {
        tile: opts.tile,
        summonKind: opts.summonKind || "decoy",
        cap: opts.cap ?? null,
        lifespan: opts.lifespan ?? 6,
        name: opts.name || `${caster.name} (decoy)`,
        hp: opts.hp ?? 1,
        art: opts.art || caster.art,
        tint: opts.tint ?? 0xaaaaff,
        stats: opts.stats,
    })
    if (unit) unit._decoy = true
    return unit
}
