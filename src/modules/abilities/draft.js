import { ALL_ABILITIES, abilityByName } from '../classes/abilities/abilityRegistry.js'

// Milestone ability draft (§14 B5/B6). HYBRID source: role-guaranteed picks drawn
// from the hero class's curated `draftPool`, plus a random wildcard from the whole
// registry. Returns up to (roleCount + wildcardCount) ability metadata records the
// hero doesn't already know. Game code, so Math.random is fine here.

function sample(arr, n) {
    const pool = arr.slice()
    const out = []
    while (out.length < n && pool.length) {
        const i = Math.floor(Math.random() * pool.length)
        out.push(pool.splice(i, 1)[0])
    }
    return out
}

// Build the offer for `hero`. roleCount role-pool picks + wildcardCount wildcards;
// if the role pool is short (small/exhausted), wildcards backfill so the player
// always sees up to the full count. Excludes ultimates, passives, and abilities
// already on the bar.
export function rollDraft(hero, { roleCount = 2, wildcardCount = 1 } = {}) {
    const known = new Set((hero?.abilities || []).filter(Boolean).map(a => a.constructor?.name))

    const rolePool = (hero?.profile?.draftPool || [])
        .map(k => abilityByName(k))
        .filter(Boolean)
        .filter(m => !m.passive && m.tier !== 'ultimate' && !known.has(m.key))

    const options = sample(rolePool, roleCount)
    const chosen = new Set(options.map(m => m.key))

    const wildPool = ALL_ABILITIES.filter(m =>
        !m.passive && m.tier !== 'ultimate' && !known.has(m.key) && !chosen.has(m.key))

    const want = (roleCount + wildcardCount) - options.length
    options.push(...sample(wildPool, want))

    // Slim records for the draft screen (and to stash on run.pendingDraft).
    return options.map(m => ({ key: m.key, name: m.name, icon: m.icon, description: m.description }))
}
