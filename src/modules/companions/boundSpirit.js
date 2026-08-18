import gameLog from "../GameLog.js"
import { summon } from "./summon.js"
import { revertAllegiance } from "./allegiance.js"

// Bound Spirit bond type (encyclopedia §6.5) — a WILLED extraplanar being called
// by a gated ritual / pact. Distinct from a mindless Construct: a spirit has its
// own will. Two bands:
//
//   LESSER (imp / cherub / lesser fiend): GATED (a stat/quest/story requirement on
//     the summoning ability). Once called, a TEMPORARY willed ally — summonSpirit().
//
//   GREATER (demon / higher angel / Seraphim / god): a CONTRACT. The being doesn't
//     care about the summoner's will, so calling it is a gamble — attemptPact()
//     rolls a contract check:
//       SUCCESS → it serves you, briefly + devastatingly (a temporary ally).
//       FAILURE → it slips the leash and goes ROGUE: turns HOSTILE and hunts the
//                 summoner / player (the scoped-down "claims the level" — it just
//                 patrols/hunts via the hunter brain; no level-takeover system yet).
//
// Both spawn through the `summon` verb with bondType 'spirit' (so they're neither
// construct-orphaned nor pet-containable). The allied form rides the 'ally' brain
// for now; a dedicated semi-autonomous "willed" brain is a future refinement.

// Roll the contract. Base chance is the ability's; the summoner's Magic attunement
// nudges the odds. Clamped so a pact is never a sure thing in either direction —
// the risk is the point.
export function contractRoll(caster, baseChance = 0.5) {
    const magic = caster?.stat?.('Magic') ?? 0
    const chance = Math.max(0.1, Math.min(0.95, baseChance + (magic - 10) * 0.02))
    return Math.random() < chance
}

// Lesser spirit (or a won pact): summon a TEMPORARY willed ally. Returns the
// follower, or null if the tile is blocked.
export function summonSpirit(caster, opts = {}) {
    return summon(caster, {
        ...opts,
        bondType: 'spirit',
        archetype: opts.archetype || 'ally',
    })
}

// Greater spirit: attempt the CONTRACT. Always summons the being; the roll decides
// whether it's your ally or your problem. Returns { success, spirit }.
export function attemptPact(caster, opts = {}) {
    const success = contractRoll(caster, opts.contractChance ?? 0.5)
    const spirit = summon(caster, {
        ...opts,
        bondType: 'spirit',
        archetype: 'ally',
        // A won pact is temporary (lifespan). A rogue keeps NO lifespan — it's a
        // real, loose threat now, not a fading summon.
        lifespan: success ? (opts.lifespan ?? 12) : null,
    })
    if (!spirit) return { success: false, spirit: null }

    if (success) {
        gameLog.log(`${caster.name}'s pact holds — ${spirit.name} answers the call.`)
    } else {
        // The being slips the leash: flip it hostile (team monster + the relentless
        // hunter brain) so it turns on the summoner and hunts the player. It keeps
        // its identity (art/stats) — the same thing you tried to bind now hunts you.
        revertAllegiance(spirit, { team: 'monster', type: 'enemy', archetype: 'hunter' })
        spirit.bondType = 'spirit'
        spirit._summonTurns = null
        gameLog.log(`${caster.name}'s pact SHATTERS — ${spirit.name} turns on them!`)
    }
    return { success, spirit }
}
