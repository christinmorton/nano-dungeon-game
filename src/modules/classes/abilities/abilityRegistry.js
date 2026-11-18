// Registry of every ability in v5 — eighteen, listed by hand: five per class
// plus one ultimate each (scope doc §5, raised from twelve to fifteen and then
// to eighteen on 2026-09-10; see §10.5 and §10.6).
//
// v3's version auto-discovers with `import.meta.glob('./*.js', { eager: true })`,
// which is the single most dangerous import in that codebase. Eagerly importing
// every ability file pulls in SummonAlly, which imports Follower, which extends
// BaseEnemy - so any module in BaseEnemy's own init chain that reached this
// registry re-entered a half-built BaseEnemy and crashed with a TDZ error. v3
// carries a standing rule about it: never statically import the registry from
// Items.js, Run.js or any core singleton.
//
// v5 does not need that rule. Twelve static imports name exactly twelve files,
// none of which is a summon, so there is no glob and nothing to re-enter. If a
// thirteenth ability is ever added it gets a line here - a chore the glob was
// meant to save, and a cheap price for deleting a whole class of crash.
//
// NOTHING BELOW READS THESE IMPORTS AT MODULE-EVALUATION TIME, and that is
// load-bearing. There is a genuine import cycle here:
//
//   Classes.js -> ranger.js -> Dash.js -> universals.js -> Dungeon.js
//              -> BaseHero.js -> abilityRegistry.js -> Dash.js
//
// Whether it crashes depends purely on which module the entry point reaches
// first. Booting through World reached Dungeon first, so the abilities were
// fully initialized by the time the registry read them and the cycle was
// invisible. Booting through Intro (which imports Classes.js for the picker)
// reaches Dash.js FIRST, so Dash is still mid-evaluation when the registry runs
// - and a top-level `const ABILITY_CLASSES = [... Dash ...]` died with
// "Cannot access 'Dash' before initialization".
//
// Building the tables lazily fixes it for every entry order: the module body
// now only defines functions, and by the time anything actually calls into the
// registry (BaseHero.learnAbility, at runtime) every module is initialized.
// Keep it that way - do not hoist these back to the top level.
import Ability from './Ability.js'

import Cleave from './Cleave.js'
import Charge from './Charge.js'
import Bulwark from './Bulwark.js'
import MightyBlow from './MightyBlow.js'
import Shove from './Shove.js'

import Dash from './Dash.js'
import PiercingLoose from './PiercingLoose.js'
import Root from './Root.js'
import Stealth from './Stealth.js'
import Sense from './Sense.js'

import FrostBolt from './FrostBolt.js'
import Barrier from './Barrier.js'
import ArcLightning from './ArcLightning.js'
import Blink from './Blink.js'
import ManaBeam from './ManaBeam.js'

// One ultimate per class (scope doc §10.5). They sit in the dedicated R slot via
// profile.ultimate, not in the four-ability kit.
import TheReaving from './TheReaving.js'
import RainOfTalons from './RainOfTalons.js'
import TheUnraveling from './TheUnraveling.js'

// A function, not a top-level array — see the cycle note above.
function abilityClasses() {
    return [
        Cleave, Charge, Bulwark, MightyBlow, Shove,
        Dash, PiercingLoose, Root, Stealth, Sense,
        FrostBolt, Barrier, ArcLightning, Blink, ManaBeam,
        TheReaving, RainOfTalons, TheUnraveling,
    ]
}

// "FrostBolt" -> "Frost Bolt" — fallback display name when a probe instance
// can't be built to read the canonical `.name` field.
function humanize(ctorName) {
    return ctorName.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}

// Build a metadata record for an ability class. Display name / icon / description
// live as class FIELDS, so probe a throwaway instance with a null hero to read
// them; the base Ability constructor only sets bookkeeping, so this is safe.
// Guarded anyway.
function describe(AbilityClass) {
    let probe = null
    try {
        probe = new AbilityClass(null)
    } catch {
        // A subclass constructor that touches the hero — fall back to the
        // constructor name rather than letting the registry crash boot.
    }
    const key = AbilityClass.name
    const name = probe?.name && probe.name !== 'Unnamed' ? probe.name : humanize(key)
    return {
        Ability: AbilityClass,
        key,                                   // stable id, e.g. "FrostBolt"
        name,                                  // display name, e.g. "Rime Lance"
        icon: probe?.icon ?? 0,
        description: probe?.description ?? '',
        target: probe?.target ?? 'self',
    }
}

// Built on first use and memoized. Deferred rather than computed at import time
// so the module body never touches the ability bindings — see the cycle note at
// the top of this file.
let _all = null
let _byLookup = null

function build() {
    if (_all) return
    _all = abilityClasses()
        .filter(AbilityClass => AbilityClass.prototype instanceof Ability)
        .map(describe)
    _byLookup = new Map()
    for (const meta of _all) {
        _byLookup.set(meta.key.toLowerCase(), meta)
        _byLookup.set(meta.name.toLowerCase(), meta)
    }
}

// ---- Public API -----------------------------------------------------------

// Every ability, in declaration order (grouped by class above).
//
// A function rather than the exported constant it used to be, because the array
// cannot exist until the abilities have initialized. No call sites in v5 today;
// kept because "list every ability" is what a registry is for.
export function allAbilities() {
    build()
    return _all
}

// Resolve an ability by display name ("Rime Lance") OR key ("FrostBolt"),
// case-insensitive. Returns the metadata record or null.
export function abilityByName(nameOrKey) {
    if (!nameOrKey) return null
    build()
    return _byLookup.get(String(nameOrKey).toLowerCase()) ?? null
}

// Construct an ability instance bound to a hero, by name or key. Returns null
// if the name is unknown (caller decides whether that's fatal).
export function makeAbility(nameOrKey, hero) {
    const meta = abilityByName(nameOrKey)
    if (!meta) return null
    return new meta.Ability(hero)
}
