import crafty from "../tags/crafty.js"
import cursedCarrier from "../tags/cursedCarrier.js"
import mapState from "../MapState.js"   // read at call-time only (excludeIf) — cycle-safe

// Enemy PERSONALITIES — the data-driven baseline "temperament" layer applied to
// every generated enemy (replaces the old flat enemyModifiers roll of
// aggro/fast/royal/crafty). An enemy rolls 2-3 non-conflicting personalities,
// tier-weighted and eligibility-gated; each layers a light stat/behavior flavor
// and shows on hover as a `#tag`. This is Layer 1 of the enemy-composition model
// (see documents / memory project_v3_enemy_generation_rebuild) — distinct from
// ARCHETYPES (core AI behavior) and AFFINITIES (elemental power, a later slice).
//
// NO color tint: color is reserved for elemental empowerment (Color=Empowerment),
// so a personality's tell is its name tag, not a hue. Royal is intentionally NOT
// here — it becomes a humanoid-only ENTITY TYPE later, never a random tag.
//
// Each effect maps to an EXISTING engine mechanism so no combat/BaseEnemy edits
// are needed:
//   stats:              base-stat deltas (flow to attack/dodge/block via stat())
//   maxHpMult:          scales maxHealthPoints
//   refresh {ap,mp,hp}: per-turn point/regen deltas (refreshRates)
//   perceptionMult:     scales detectionRadius + visionConeDegrees
//   damageTakenMult:    wraps the victim-side damageTakenMult() shim (aegis/marked pattern)
//   outgoingDamageMult: wraps the attacker-side outgoingDamageMult() shim
//   flags:              plain fields other systems read (some are behavior stubs
//                       for a later pass — noted); tag: a Taggable module for
//                       real per-turn/on-hit behavior (Crafty, Cursed).
//
// tier weights the roll; gate limits WHERE it can appear; conflicts stops two
// opposed traits landing together; excludeIf gates per enemy class.

export const PERSONALITIES = {
    // --- universal (any enemy) ---------------------------------------------
    aggressive:  { label: "Aggressive",  tier: "common",   refresh: { ap: 1 } },
    brutish:     { label: "Brutish",     tier: "common",   stats: { STR: 3 } },
    reckless:    { label: "Reckless",    tier: "uncommon", outgoingDamageMult: 1.25, damageTakenMult: 1.25 },
    frenzied:    { label: "Frenzied",    tier: "uncommon", stats: { STR: 2 }, refresh: { ap: 1 }, flags: { _frenzied: true } }, // TODO: escalate below half HP
    defensive:   { label: "Defensive",   tier: "common",   stats: { CON: 2 }, damageTakenMult: 0.9 },
    tough:       { label: "Tough",       tier: "common",   maxHpMult: 1.3 },
    armored:     { label: "Armored",     tier: "uncommon", damageTakenMult: 0.8 },
    stubborn:    { label: "Stubborn",    tier: "uncommon", flags: { _resistForcedMove: true } },
    swift:       { label: "Swift",       tier: "common",   refresh: { mp: 1 } },
    nimble:      { label: "Nimble",      tier: "uncommon", stats: { DEX: 3, SPD: 2 } }, // raises the dodge stat
    lumbering:   { label: "Lumbering",   tier: "common",   maxHpMult: 1.25, stats: { SPD: -3 }, conflicts: ["swift"] }, // slow cadence, not immobile (SPD, not MP)
    restless:    { label: "Restless",    tier: "common",   flags: { _restless: true } }, // TODO: wander more when idle
    keen:        { label: "Keen",        tier: "common",   perceptionMult: 1.4 },
    oblivious:   { label: "Oblivious",   tier: "common",   perceptionMult: 0.6, conflicts: ["keen"] },
    vigilant:    { label: "Vigilant",    tier: "uncommon", perceptionMult: 1.15, flags: { _vigilant: true } },
    cowardly:    { label: "Cowardly",    tier: "common",   flags: { _cowardly: true } }, // TODO: raise flee threshold
    feral:       { label: "Feral",       tier: "uncommon", stats: { STR: 2, SPD: 2, INT: -3 } },
    zealous:     { label: "Zealous",     tier: "uncommon", outgoingDamageMult: 1.1, flags: { _zealous: true } }, // TODO: scale by nearby allies
    regenerating:{ label: "Regenerating",tier: "rare",     refresh: { hp: 1 } },
    crafty:      { label: "Crafty",      tier: "rare",     tag: crafty, excludeIf: (e) => e.constructor?.canBeCrafty === false },

    // --- archer (ranged weapon) --------------------------------------------
    deadeye:     { label: "Deadeye",     tier: "common",   gate: "ranged", outgoingDamageMult: 1.2 },
    sniper:      { label: "Sniper",      tier: "uncommon", gate: "ranged", stats: { DEX: 2 }, flags: { _sniper: true } }, // TODO: scale by range
    rapid:       { label: "Rapid",       tier: "uncommon", gate: "ranged", refresh: { ap: 1 } },
    elusive:     { label: "Elusive",     tier: "common",   gate: "ranged", stats: { SPD: 2 }, flags: { _kites: true } }, // TODO: step back after firing

    // --- caster (magic user) — gate is FUZZY in v3, tightens with role rosters
    attuned:     { label: "Attuned",     tier: "common",   gate: "caster", stats: { Magic: 3 } },
    hexer:       { label: "Hexer",       tier: "uncommon", gate: "caster", stats: { Magic: 2 }, flags: { _hexer: true } }, // TODO: on-hit debuff rider
    channeler:   { label: "Channeler",   tier: "uncommon", gate: "caster", stats: { Magic: 3 }, flags: { _channeler: true } }, // TODO: windup + bigger cast
    draining:    { label: "Draining",    tier: "rare",     gate: "caster", stats: { Magic: 1 }, flags: { _draining: true } }, // TODO: leech on hit

    // --- thrower (throwing weapon) -----------------------------------------
    barrage:     { label: "Barrage",     tier: "uncommon", gate: "thrower", refresh: { ap: 1 } },
    heavyThrower:{ label: "Heavy-thrower",tier: "common",  gate: "thrower", outgoingDamageMult: 1.2 },

    // --- special (dangerous) -----------------------------------------------
    cursed:      { label: "Cursed",      tier: "rare",     tag: cursedCarrier, excludeIf: () => !!(mapState && mapState.noCursed) },
}

export const PERSONALITY_KEYS = Object.keys(PERSONALITIES)

const TIER_WEIGHT = { common: 6, uncommon: 3, rare: 1 }

// How many personalities an enemy gets, weighted so MOST are solo-tagged, SOME
// double, a FEW triple (user-tuned 2026-07-16). Weights 5/3/1 ≈ 56% / 33% / 11%.
// A future Dungeon-tab "enemy behavior" section will let the designer override
// these per dungeon (engine-first, designer-later).
const COUNT_WEIGHTS = [{ n: 1, w: 5 }, { n: 2, w: 3 }, { n: 3, w: 1 }]

function rollCount() {
    const total = COUNT_WEIGHTS.reduce((s, c) => s + c.w, 0)
    let r = Math.random() * total
    for (const c of COUNT_WEIGHTS) { r -= c.w; if (r <= 0) return c.n }
    return 1
}

// --- eligibility gates ------------------------------------------------------
// Kept defensive: an undeterminable gate simply excludes the personality (never
// throws), so a weapon shape we can't classify just doesn't roll ranged/thrower.
function hasRangedWeapon(enemy) {
    const w = enemy.weapon
    return !!(w && typeof w.range === "function" && w.range() > 1)
}
function hasThrowingWeapon(enemy) {
    const w = enemy.weapon
    return !!(w && (w.thrown === true || w.throwable === true))
}
function isCaster(enemy) {
    if (enemy.archetype === "caster") return true
    const magic = enemy.stats?.Magic ?? 0
    return magic >= 8
}
function gateOk(enemy, gate) {
    if (!gate) return true
    if (gate === "ranged") return hasRangedWeapon(enemy)
    if (gate === "thrower") return hasThrowingWeapon(enemy)
    if (gate === "caster") return isCaster(enemy)
    return false
}

function eligibleKeys(enemy) {
    return PERSONALITY_KEYS.filter(k => {
        const p = PERSONALITIES[k]
        if (p.gate && !gateOk(enemy, p.gate)) return false
        if (p.excludeIf && p.excludeIf(enemy)) return false
        return true
    })
}

function weightedPick(pool) {
    const weights = pool.map(k => TIER_WEIGHT[PERSONALITIES[k].tier] ?? TIER_WEIGHT.uncommon)
    const total = weights.reduce((s, w) => s + w, 0)
    let r = Math.random() * total
    for (let i = 0; i < pool.length; i++) {
        r -= weights[i]
        if (r <= 0) return pool[i]
    }
    return pool[pool.length - 1]
}

// Roll a conflict-free set of `count` eligible personality keys. Default count
// is the weighted 1/2/3 roll (mostly solo — see COUNT_WEIGHTS).
export function rollPersonalities(enemy, count) {
    count = count ?? rollCount()
    let pool = eligibleKeys(enemy)
    const picked = []
    while (picked.length < count && pool.length) {
        const k = weightedPick(pool)
        pool = pool.filter(x => x !== k)
        const p = PERSONALITIES[k]
        picked.push(k)
        if (p.conflicts && p.conflicts.length) {
            pool = pool.filter(x => !p.conflicts.includes(x))
        }
    }
    return picked
}

// Build the Taggable template for a data-driven personality (no custom `tag`).
// initialize applies the static effects; the two damage shims are added as
// handlers only when the entry uses them (so they wrap the base method).
function buildTemplate(p) {
    const tpl = {
        name: p.label,
        initialize: function () { applyStatic(this, p) },
    }
    if (p.damageTakenMult != null) {
        tpl.damageTakenMult = function (mult) { return (mult ?? 1) * p.damageTakenMult }
    }
    if (p.outgoingDamageMult != null) {
        tpl.outgoingDamageMult = function (running) { return (running ?? 1) * p.outgoingDamageMult }
    }
    return tpl
}

function applyStatic(enemy, p) {
    if (p.stats) {
        for (const [k, v] of Object.entries(p.stats)) {
            enemy.stats[k] = Math.max(0, (enemy.stats[k] ?? 0) + v)
        }
    }
    if (p.maxHpMult) {
        enemy.maxHealthPoints = Math.max(1, Math.round(enemy.maxHealthPoints * p.maxHpMult))
        enemy.healthPoints = enemy.maxHealthPoints
    }
    if (p.refresh) {
        const r = enemy.refreshRates
        if (p.refresh.ap) r.actionPoints = Math.max(0, r.actionPoints + p.refresh.ap)
        if (p.refresh.mp) r.movementPoints = Math.max(0, r.movementPoints + p.refresh.mp)
        if (p.refresh.hp) r.healthPoints = (r.healthPoints ?? 0) + p.refresh.hp
    }
    if (p.perceptionMult) {
        enemy.detectionRadius = Math.max(1, Math.round((enemy.detectionRadius ?? 0) * p.perceptionMult))
        enemy.visionConeDegrees = Math.min(180, Math.round((enemy.visionConeDegrees ?? 0) * p.perceptionMult))
    }
    if (p.flags) Object.assign(enemy, p.flags)
}

// Apply one personality by key (idempotent per enemy).
export function applyPersonality(enemy, key) {
    const p = PERSONALITIES[key]
    if (!p) return
    if (!enemy._personalities) enemy._personalities = []
    if (enemy._personalities.includes(key)) return
    enemy._personalities.push(key)
    enemy.addTag(p.tag ? p.tag : buildTemplate(p))
}

// Roll and apply 2-3 personalities to a freshly finalized enemy.
export function applyRandomPersonalities(enemy) {
    for (const key of rollPersonalities(enemy)) applyPersonality(enemy, key)
    return enemy
}
