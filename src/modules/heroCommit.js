// heroCommit.js — pure hero-roster commit orchestration (rebuild phase 2, doc §4).
// This is where the save-on-win / permadeath LOGIC lives, factored out of Run.js so
// it can be HEADLESS-TESTED (Run.js can't import under Node — its singleton chain
// pulls Phaser). Node-importable + cycle-safe: imports only the pure character
// schema, takes the `account` singleton as a PARAMETER (never imports it), and
// touches no Phaser and no ability registry. Run.js is a thin adapter that feeds
// these functions its run state.
//
// The flat account book (Account.commitLearned / BaseHero.applyAccountBook) is
// untouched — ability-drawing into runs is unchanged; this adds the character loop
// ALONGSIDE it. Nothing in the live flow calls this yet (wires in at the Guild Hall
// UI phase, doc §13 phase 6).

import { makeCharacter, normalizeCharacter, normalizeRunRecord } from "../data/character.js"

// Dedup-merge two registry-key lists, order-preserving.
function mergeKeys(a, b) {
    const out = Array.isArray(a) ? a.slice() : []
    for (const k of (b || [])) if (k && !out.includes(k)) out.push(k)
    return out
}

// The in-flight hero for a run: CONTINUE a stored roster hero (`spec.continue` = a
// Character) or MINT a fresh one from a class (`spec.heroClass`/name/motivation/lore).
export function makeInFlightCharacter(spec = {}) {
    return spec && spec.continue
        ? normalizeCharacter(spec.continue)
        : makeCharacter({
            heroClass: spec.heroClass,
            name: spec.name,
            motivation: spec.motivation,
            lore: spec.lore,
        })
}

// Assemble a RunRecord (doc §3.3) from run state. `runState` = { stats, time, seed }
// (what the caller can derive); `extra` = { seed, killedBy, date } overrides.
export function buildRunRecord(runState, outcome, extra = {}) {
    const rs = runState || {}
    const s = rs.stats || {}
    const time = rs.time || { totalSeconds: 0, totalRounds: 0 }
    return normalizeRunRecord({
        seed: extra.seed != null ? extra.seed : (rs.seed != null ? rs.seed : null),
        outcome,
        deepestFloor: s.deepestFloor || 0,
        kills: s.kills || 0,
        itemsFound: s.itemsFound || 0,
        seconds: time.totalSeconds || 0,
        rounds: time.totalRounds || 0,
        killedBy: extra.killedBy || null,
        date: extra.date || new Date().toISOString(),
    })
}

// Extraction commit on a WIN (doc §4.1): merge the run's learned kit onto the hero +
// append the win record, then persist — UPDATE if the hero is on the roster (a
// continued hero), else ADD (a newly-saved hero, slot permitting). `learned` =
// { learnedAbilities, learnedTraits }. Returns the committed character, or null
// (no in-flight hero, or the roster was full on a new save).
export function commitWin(account, character, learned = {}, record) {
    if (!character) return null
    const existing = account.getCharacter(character.id)
    if (existing) {
        return account.updateCharacter(existing.id, (cur) => ({
            ...cur,
            learnedAbilities: mergeKeys(cur.learnedAbilities, learned.learnedAbilities),
            learnedTraits: mergeKeys(cur.learnedTraits, learned.learnedTraits),
            history: [...cur.history, record],
            lastRunAt: record.date,
        }))
    }
    return account.addCharacter({
        ...character,
        learnedAbilities: mergeKeys(character.learnedAbilities, learned.learnedAbilities),
        learnedTraits: mergeKeys(character.learnedTraits, learned.learnedTraits),
        history: [...character.history, record],
        lastRunAt: record.date,
    })
}

// Permadeath commit on a DEATH (doc §4.2): a hero already on the roster (a continued
// hero) is moved to the Fallen wall with the death record — its run gains are DROPPED
// (extraction-gating), so the STORED/pristine copy falls, not the in-flight one. A
// fresh never-saved hero vanishes (nothing on the roster to move). Returns the fallen
// character, or null.
export function commitDeath(account, character, record) {
    if (!character) return null
    const existing = account.getCharacter(character.id)
    if (!existing) return null
    return account.killCharacter(existing.id, record)
}
