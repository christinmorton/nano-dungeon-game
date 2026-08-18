import burning from '../tags/burning.js'
import slow from '../tags/slow.js'
import poison from '../tags/poison.js'
import acid from '../tags/acid.js'
import cursed from '../tags/cursed.js'
import shocked from '../tags/shocked.js'
import illuminated from '../tags/illuminated.js'
import unmaking from '../tags/unmaking.js'
import smitten from '../tags/smitten.js'
import damned from '../tags/damned.js'
// NOTE: affinity PASSIVES live in abilities/affinityPassives.js (basic pools +
// advanced base passives), NOT here — keeping this combat-critical module free of
// the universals-importing passive tags (and the affinities↔universals cycle).

// Affinity registry (§14, expanded to two-slot in §18). A hero / enemy /
// sentient-item carries up to TWO affinities: `entity.affinityBasic` (one of the 9
// elements, swappable via essences) and `entity.affinityAdvanced` (one of the 6
// cosmic types, bound via pact/force). Either may be null. BOTH layer onto outgoing
// damage and BOTH stack (the combat helpers below iterate both). NOT bought/leveled
// with skill points; see BaseHero.grantAffinity for the per-tier grant routing.
//
// Each affinity bundles a few simple parameters (combine 2-3 for stronger builds):
//   - element TRAIT: on every hit the entity deals, the affinity LAYERS its element
//     (+`bonus` damage + the `status` rider); SAME-element hits AMPLIFY (`ampBonus`).
//   - `statBonus`: applied to the entity's base stats when the affinity is granted.
//   - PASSIVES are no longer a field here — they live in abilities/affinityPassives.js
//     (basic affinities roll/draft one from a POOL; advanced ones get a fixed base one).
//   - `tier`: 'basic' affinities are obtainable in-run (an affinity-essence
//     consumable from a rare drop/condition, or a quest); 'advanced' ones (curse +
//     the cosmic/principle types — light/void/holy/seraphic/demonic) are NEVER given
//     by the basic path — only via pact conditions or a hidden mechanic (defined later).
//
// `flavor` is the damageFlavor string the affinity behaves as — it matches an
// ability/weapon's base `damageFlavor` (for amp) and selects the status rider.
// A status rider is OPTIONAL and applied only where the element is naturally
// status-shaped. Mundane: fire→Burning, frost→Slow, poison→Poison, acid→Acid (HP +
// armor melt), lightning→Shocked. Cosmic (advanced): curse→Cursed, light→Illuminated
// (INTERIM -dodge; creative rework parked), void→Unmaking (-barrier + anti-heal), holy→Smitten
// (radiant DoT, ×2 vs unholy), demonic→Damned (saps the target's outgoing damage)
// PLUS a `passive` (Devour — lifesteal, the demon's hunger). earth/wind/arcane and
// seraphic stay damage-only by design — identity = statBonus + amp, not a debuff.
// Note (Phase 4 audit): Taggable.addTag dedupes by name, so a rider re-applied on
// each hit is a no-op while already active — affinity statuses are INTERMITTENT,
// not refreshed-on-hit; the riders are chosen to read fine under that. New
// affinity = one row.

export const AFFINITIES = {
    physical:  { label: 'Physical',  tier: 'basic',    flavor: 'physical',  status: null,    bonus: 2, ampBonus: 4, statBonus: { STR: 3 } },
    fire:      { label: 'Fire',      tier: 'basic',    flavor: 'fire',      status: burning, bonus: 2, ampBonus: 4, statBonus: { Magic: 3 } },
    frost:     { label: 'Frost',     tier: 'basic',    flavor: 'ice',       status: slow,    bonus: 2, ampBonus: 4, statBonus: { Magic: 3 } },
    poison:    { label: 'Poison',    tier: 'basic',    flavor: 'poison',    status: poison,  bonus: 2, ampBonus: 4, statBonus: { Magic: 2 } },
    acid:      { label: 'Acid',      tier: 'basic',    flavor: 'acid',      status: acid,    bonus: 2, ampBonus: 4, statBonus: { Magic: 2 } },
    lightning: { label: 'Lightning', tier: 'basic',    flavor: 'lightning', status: shocked, bonus: 2, ampBonus: 4, statBonus: { Magic: 2, SPD: 1 } },
    earth:     { label: 'Earth',     tier: 'basic',    flavor: 'earth',     status: null,    bonus: 2, ampBonus: 4, statBonus: { CON: 3 } },
    wind:      { label: 'Wind',      tier: 'basic',    flavor: 'wind',      status: null,    bonus: 2, ampBonus: 4, statBonus: { SPD: 3 } },
    arcane:    { label: 'Arcane',    tier: 'basic',    flavor: 'arcane',    status: null,    bonus: 2, ampBonus: 4, statBonus: { Magic: 3, INT: 1 } },
    curse:     { label: 'Curse',     tier: 'advanced', flavor: 'curse',     status: cursed,      bonus: 2, ampBonus: 4, statBonus: { Magic: 2 } },
    light:     { label: 'Light',     tier: 'advanced', flavor: 'light',     status: illuminated, bonus: 2, ampBonus: 4, statBonus: { Magic: 3 } },
    void:      { label: 'Void',      tier: 'advanced', flavor: 'void',      status: unmaking,    bonus: 2, ampBonus: 4, statBonus: { Magic: 3 } },
    holy:      { label: 'Holy',      tier: 'advanced', flavor: 'holy',      status: smitten,     bonus: 3, ampBonus: 5, statBonus: { Magic: 3, CON: 1 } },
    seraphic:  { label: 'Seraphic',  tier: 'advanced', flavor: 'seraphic',  status: null,        bonus: 3, ampBonus: 5, statBonus: { Magic: 4 } },
    demonic:   { label: 'Demonic',   tier: 'advanced', flavor: 'demonic',   status: damned,      bonus: 3, ampBonus: 5, statBonus: { STR: 2, Magic: 2 } },
}

export const AFFINITY_KEYS = Object.keys(AFFINITIES)

// Affinities obtainable through the basic in-run path (essence consumable / quest).
// Advanced ones are pact/hidden-gated (defined later) and excluded here.
export const BASIC_AFFINITY_KEYS = AFFINITY_KEYS.filter(k => AFFINITIES[k].tier === 'basic')

// Empowerment (empowered-basics vector): a BASIC slot can carry a TIER — 0 = plain,
// 1 = empowered (a mythical beast's gift; a future upgrade node increments the same
// field). Each tier scales the slot's per-hit bonus/ampBonus AND its stat payload by
// this fraction. Advanced (bound) affinities are never empowered. Tunable.
export const EMPOWER_BONUS_PER_TIER = 0.5
// How far the basic slot can be empowered. A beast boon grants tier 1; the affinity
// upgrade tree (Skillbook) buys tiers up to this cap with affinity shards.
export const MAX_EMPOWER_TIER = 3
export function empowermentMult(tier) {
    return 1 + (tier || 0) * EMPOWER_BONUS_PER_TIER
}

export function affinityFor(key) {
    return key ? (AFFINITIES[key] || null) : null
}

// The affinity keys an entity currently carries (§18 two-slot model): a basic
// (swappable) + an advanced (bound). Either may be null. Both layer onto outgoing
// damage, so the combat helpers iterate BOTH.
export function affinityKeysOf(entity) {
    return [entity?.affinityBasic, entity?.affinityAdvanced]
}

// Bonus damage the attacker's affinities add to a hit whose base element is
// `baseFlavor` (the weapon/ability's own flavor, or undefined). Each slot amps
// when it matches; otherwise the layer bonus. BOTH slots stack (§18). 0 when
// unattuned.
export function affinityBonus(attacker, baseFlavor) {
    let total = 0
    const basicKey = attacker?.affinityBasic
    const basicTier = attacker?.affinityBasicTier || 0
    for (const key of affinityKeysOf(attacker)) {
        const aff = affinityFor(key)
        if (!aff) continue
        const base = (baseFlavor && baseFlavor === aff.flavor) ? aff.ampBonus : aff.bonus
        // Empowerment scales ONLY the basic slot (advanced is bound, not empowerable).
        const mult = (key === basicKey && basicTier > 0) ? empowermentMult(basicTier) : 1
        total += Math.round(base * mult)
    }
    return total
}

// Apply the attacker's affinity status riders to a SURVIVING victim — BOTH slots
// (§18). Each is skipped when the base flavor already IS that affinity's element
// (the hit applied the status itself) or the element has no status authored.
export function applyAffinityStatus(attacker, victim, baseFlavor) {
    if (!victim || victim.healthPoints <= 0) return
    for (const key of affinityKeysOf(attacker)) {
        const aff = affinityFor(key)
        if (!aff || !aff.status) continue
        if (baseFlavor && baseFlavor === aff.flavor) continue
        victim.addTag(aff.status)
    }
}
