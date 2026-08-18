// Central registry of every ability — auto-discovered via Vite glob import (the
// same pattern settlementProfiles.js and RecipeLoader.js use), so a newly added
// ability file is enumerated automatically with no manual registration to forget.
//
// Two jobs:
//   1. The enumerable "all abilities" list the A->Z training bench drives
//      (alphabetical / sequential / random — see documents below).
//   2. The seed of the skillbook catalog and the lookup that resolves
//      tome `teaches: "Cleave"` strings — see
//      documents/v3_ability_progression_system.md (§5, §7).
//
// The registry is hero-agnostic: it holds CLASSES + metadata, never instances.
// makeAbility(name, hero) constructs one bound to a hero when you actually need it.

import Ability from './Ability.js'
import Passive from './Passive.js'

// Eager-import every module in this directory. The registry classifies by
// prototype chain, so base classes and the debug Placeholder are filtered out.
const modules = import.meta.glob('./*.js', { eager: true })

// Infrastructure / non-usable entries (by constructor name).
const EXCLUDED = new Set(['Ability', 'Passive', 'Placeholder'])

// "FrostBolt" -> "Frost Bolt" — fallback display name when a probe instance
// can't be built to read the canonical `.name` field.
function humanize(ctorName) {
    return ctorName.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}

// Build a metadata record for an ability class. The display name / icon /
// description live as class FIELDS (set in the constructor), so we probe a
// throwaway instance with a null hero to read them; the base Ability/Passive
// constructors only set bookkeeping, so this is safe. Guarded anyway.
function describe(AbilityClass) {
    let probe = null
    try {
        probe = new AbilityClass(null)
    } catch {
        // A subclass constructor that touches the hero — fall back to the
        // constructor name. Rare; logged-free so the registry can't crash boot.
    }
    const key = AbilityClass.name
    const name = probe?.name && probe.name !== 'Unnamed' ? probe.name : humanize(key)
    return {
        Ability: AbilityClass,
        key,                                   // stable id, e.g. "FrostBolt"
        name,                                  // display name, e.g. "Frost Bolt"
        icon: probe?.icon ?? 0,
        description: probe?.description ?? '',
        target: probe?.target ?? 'self',
        tier: probe?.tier ?? 'normal',         // 'ultimate' excluded from draft wildcards
        passive: AbilityClass.prototype instanceof Passive,
    }
}

const actives = []
const passives = []

for (const path in modules) {
    if (path.endsWith('/abilityRegistry.js')) continue   // never include self
    const AbilityClass = modules[path]?.default
    if (typeof AbilityClass !== 'function') continue
    if (EXCLUDED.has(AbilityClass.name)) continue
    if (AbilityClass.prototype instanceof Passive) {
        passives.push(describe(AbilityClass))
    } else if (AbilityClass.prototype instanceof Ability) {
        actives.push(describe(AbilityClass))
    }
}

// Stable index order (filename order from the glob) — used for stepping
// next/prev through the set in the training bench.
const SEQUENTIAL = actives.slice()
const ALPHABETICAL = actives.slice().sort((a, b) => a.name.localeCompare(b.name))
const BY_LOOKUP = new Map()
for (const meta of [...actives, ...passives]) {
    BY_LOOKUP.set(meta.key.toLowerCase(), meta)
    BY_LOOKUP.set(meta.name.toLowerCase(), meta)
}

// ---- Public API -----------------------------------------------------------

// Every ACTIVE ability, in stable sequential (filename) order.
export const ALL_ABILITIES = SEQUENTIAL

// Every PASSIVE ability (WarriorEnrage, ClericRegen, …), separated out since
// they have no activate() and don't belong on a castable bar.
export const ALL_PASSIVES = passives

// Active abilities sorted A->Z by display name (the order the A->Z pass walks).
export function abilitiesAlphabetical() {
    return ALPHABETICAL.slice()
}

// Active abilities in stable index order — for next/prev stepping in the bench.
export function abilitiesSequential() {
    return SEQUENTIAL.slice()
}

// A random active ability's metadata. Math.random is fine here (game code, not
// a workflow script). Pass a seedable picker later if deterministic runs matter.
export function randomAbility() {
    if (SEQUENTIAL.length === 0) return null
    return SEQUENTIAL[Math.floor(Math.random() * SEQUENTIAL.length)]
}

// Resolve an ability by display name ("Frost Bolt") OR key ("FrostBolt"),
// case-insensitive. Returns the metadata record or null. This is what the
// tome `teaches` strings and the future skillbook resolve through.
export function abilityByName(nameOrKey) {
    if (!nameOrKey) return null
    return BY_LOOKUP.get(String(nameOrKey).toLowerCase()) ?? null
}

// Construct an ability instance bound to a hero, by name or key. Returns null
// if the name is unknown (caller decides whether that's fatal).
export function makeAbility(nameOrKey, hero) {
    const meta = abilityByName(nameOrKey)
    if (!meta) return null
    return new meta.Ability(hero)
}
