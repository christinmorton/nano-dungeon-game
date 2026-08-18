// affinityPassives.js — the PASSIVE-CONTENT layer for affinities (§18).
//
// Kept deliberately SEPARATE from the combat-critical affinities.js: some passive
// trait tags import universals (Arcane Reflection → resolveDamage), and affinities.js
// is imported by Combat/universals themselves — so wiring the passives here, behind a
// module that only BaseHero / screens import, keeps affinities.js's graph free of an
// affinities↔universals cycle. These classes also live OUTSIDE classes/abilities/, so
// the ability-registry glob never enumerates them as learnable abilities.
//
// Basic affinities expose a POOL: one passive is rolled (common essence) or drafted
// (rare "Pure" essence) onto the hero when they attune. Advanced affinities expose a
// single, stronger FIXED base passive (no pool).

import Passive from '../classes/abilities/Passive.js'
import Devour from '../classes/abilities/Devour.js'
// Physical/earth/wind pools reuse existing generic passives (all in classes/abilities/).
import KeenEdge from '../classes/abilities/KeenEdge.js'
import Toughness from '../classes/abilities/Toughness.js'
import Bloodthirst from '../classes/abilities/Bloodthirst.js'
import Thorns from '../classes/abilities/Thorns.js'
import Opportunist from '../classes/abilities/Opportunist.js'
import Deflection from '../classes/abilities/Deflection.js'
import SteelMind from '../classes/abilities/SteelMind.js'
import Survivalist from '../classes/abilities/Survivalist.js'
import WarriorEnrage from '../classes/abilities/WarriorEnrage.js'
import FleetFooted from '../classes/abilities/FleetFooted.js'
import Adrenaline from '../classes/abilities/Adrenaline.js'
import FastHands from '../classes/abilities/FastHands.js'
import Momentum from '../classes/abilities/Momentum.js'
import EagleEye from '../classes/abilities/EagleEye.js'
import curseCorruption from '../tags/curseCorruption.js'
import radiance from '../tags/radiance.js'
import oblivion from '../tags/oblivion.js'
import aegis from '../tags/aegis.js'
import seraphicGrace from '../tags/seraphicGrace.js'

import arcaneWard from '../tags/arcaneWard.js'
import overchannel from '../tags/overchannel.js'
import arcanistsEdge from '../tags/arcanistsEdge.js'
import fleetFooted from '../tags/fleetFooted.js'
import arcaneReflection from '../tags/arcaneReflection.js'
import manaSiphon from '../tags/manaSiphon.js'
import arcaneMomentum from '../tags/arcaneMomentum.js'
import spellPierce from '../tags/spellPierce.js'
// Fire pool tags (+ regeneration reused for Emberheart).
import kindle from '../tags/kindle.js'
import combustion from '../tags/combustion.js'
import immolation from '../tags/immolation.js'
import cinder from '../tags/cinder.js'
import regeneration from '../tags/regeneration.js'
// Frost pool tags.
import bitterCold from '../tags/bitterCold.js'
import rimeguard from '../tags/rimeguard.js'
import coldSnap from '../tags/coldSnap.js'
import frostshield from '../tags/frostshield.js'
// Poison / Acid / Lightning pool tags (+ bloodthirst reused, kindle/oblivion/
// regeneration reused via themed wrappers).
import virulence from '../tags/virulence.js'
import venomousSkin from '../tags/venomousSkin.js'
import contagion from '../tags/contagion.js'
import etch from '../tags/etch.js'
import causticSkin from '../tags/causticSkin.js'
import meltdown from '../tags/meltdown.js'
import overload from '../tags/overload.js'
import staticField from '../tags/staticField.js'
import chainReaction from '../tags/chainReaction.js'
import bloodthirst from '../tags/bloodthirst.js'

// --- Arcane pool (8) — the generalist caster's options -----------------------
class ArcaneWard extends Passive {
    name = 'Arcane Ward'; icon = 0
    description = 'Passive (Arcane): +6 barrier — magic mitigation.'
    tags = [arcaneWard]
}
class Overchannel extends Passive {
    name = 'Overchannel'; icon = 0
    description = 'Passive (Arcane): +4 magic power.'
    tags = [overchannel]
}
class ArcanistsEdge extends Passive {
    name = "Arcanist's Edge"; icon = 0
    description = 'Passive (Arcane): +8% critical chance.'
    tags = [arcanistsEdge]
}
class QuickStep extends Passive {
    name = 'Quick Step'; icon = 0
    description = 'Passive (Arcane): +1 maximum movement.'
    tags = [fleetFooted]
}
class ArcaneReflection extends Passive {
    name = 'Arcane Reflection'; icon = 0
    description = 'Passive (Arcane): attackers take arcane backlash when they hit you.'
    tags = [arcaneReflection]
}
class ManaSiphon extends Passive {
    name = 'Mana Siphon'; icon = 0
    description = 'Passive (Arcane): siphon a little HP from every blow you land.'
    tags = [manaSiphon]
}
class ArcaneMomentum extends Passive {
    name = 'Arcane Momentum'; icon = 0
    description = 'Passive (Arcane): landing a kill surges your magic power briefly.'
    tags = [arcaneMomentum]
}
class SpellPierce extends Passive {
    name = 'Spell Pierce'; icon = 0
    description = 'Passive (Arcane): your magic damage ignores some of the target\'s barrier.'
    tags = [spellPierce]
}

// --- Fire pool (5) — the burning caster ------------------------------------------
class Kindle extends Passive {
    name = 'Kindle'; icon = 0
    description = 'Passive (Fire): +4 magic power.'
    tags = [kindle]
}
class Combustion extends Passive {
    name = 'Combustion'; icon = 0
    description = 'Passive (Fire): +25% damage to Burning targets.'
    tags = [combustion]
}
class Immolation extends Passive {
    name = 'Immolation'; icon = 0
    description = 'Passive (Fire): melee attackers who strike you catch fire.'
    tags = [immolation]
}
class Cinder extends Passive {
    name = 'Cinder'; icon = 0
    description = 'Passive (Fire): enemies you kill burst, setting adjacent foes ablaze.'
    tags = [cinder]
}
class Emberheart extends Passive {
    name = 'Emberheart'; icon = 0
    description = 'Passive (Fire): the inner flame sustains you — heal 1 HP each turn.'
    tags = [regeneration]
}

// --- Frost pool (5) — control caster ---------------------------------------------
class BitterCold extends Passive {
    name = 'Bitter Cold'; icon = 0
    description = 'Passive (Frost): +25% damage to Slowed targets.'
    tags = [bitterCold]
}
class Rimeguard extends Passive {
    name = 'Rimeguard'; icon = 0
    description = 'Passive (Frost): melee attackers who strike you are Slowed.'
    tags = [rimeguard]
}
class ColdSnap extends Passive {
    name = 'Cold Snap'; icon = 0
    description = 'Passive (Frost): enemies you kill release a burst of cold, Slowing adjacent foes.'
    tags = [coldSnap]
}
class Frostshield extends Passive {
    name = 'Frostshield'; icon = 0
    description = 'Passive (Frost): +6 barrier — an icy ward against magic.'
    tags = [frostshield]
}
class Icebound extends Passive {
    name = 'Icebound'; icon = 0
    description = 'Passive (Frost): the cold preserves you — heal 1 HP each turn.'
    tags = [regeneration]
}

// --- Poison pool (5) — attrition assassin ----------------------------------------
class Virulence extends Passive {
    name = 'Virulence'; icon = 0
    description = 'Passive (Poison): +25% damage to Poisoned targets.'
    tags = [virulence]
}
class VenomousSkin extends Passive {
    name = 'Venomous Skin'; icon = 0
    description = 'Passive (Poison): melee attackers who strike you are Poisoned.'
    tags = [venomousSkin]
}
class Contagion extends Passive {
    name = 'Contagion'; icon = 0
    description = 'Passive (Poison): enemies you kill spread Poison to adjacent foes.'
    tags = [contagion]
}
class NoxiousMight extends Passive {
    name = 'Noxious Might'; icon = 0
    description = 'Passive (Poison): +4 magic power.'
    tags = [kindle]
}
class Parasite extends Passive {
    name = 'Parasite'; icon = 0
    description = 'Passive (Poison): drain life from your kills — heal on a kill.'
    tags = [bloodthirst]
}

// --- Acid pool (5) — siege / armor-melt ------------------------------------------
class Etch extends Passive {
    name = 'Etch'; icon = 0
    description = 'Passive (Acid): +25% damage to Acid-afflicted targets.'
    tags = [etch]
}
class CausticSkin extends Passive {
    name = 'Caustic Skin'; icon = 0
    description = 'Passive (Acid): melee attackers who strike you are coated in Acid.'
    tags = [causticSkin]
}
class Meltdown extends Passive {
    name = 'Meltdown'; icon = 0
    description = 'Passive (Acid): enemies you kill splash Acid onto adjacent foes.'
    tags = [meltdown]
}
class Solvent extends Passive {
    name = 'Solvent'; icon = 0
    description = 'Passive (Acid): your damage dissolves defenses — ignores some armor and barrier.'
    tags = [oblivion]
}
class CorrosiveVigor extends Passive {
    name = 'Corrosive Vigor'; icon = 0
    description = 'Passive (Acid): heal 1 HP each turn.'
    tags = [regeneration]
}

// --- Lightning pool (5) — aggressive burst ---------------------------------------
class Overload extends Passive {
    name = 'Overload'; icon = 0
    description = 'Passive (Lightning): +25% damage to Shocked targets.'
    tags = [overload]
}
class StaticField extends Passive {
    name = 'Static Field'; icon = 0
    description = 'Passive (Lightning): melee attackers who strike you are Shocked.'
    tags = [staticField]
}
class ChainReaction extends Passive {
    name = 'Chain Reaction'; icon = 0
    description = 'Passive (Lightning): enemies you kill discharge, Shocking adjacent foes.'
    tags = [chainReaction]
}
class Galvanize extends Passive {
    name = 'Galvanize'; icon = 0
    description = 'Passive (Lightning): +4 magic power.'
    tags = [kindle]
}
class Stormheart extends Passive {
    name = 'Stormheart'; icon = 0
    description = 'Passive (Lightning): heal 1 HP each turn.'
    tags = [regeneration]
}

// Basic-tier pools (one rolled/drafted on attune). Arcane = 8; the other 8 basics
// land in Phase 4.
export const BASIC_PASSIVE_POOLS = {
    arcane: [ArcaneWard, Overchannel, ArcanistsEdge, QuickStep, ArcaneReflection, ManaSiphon, ArcaneMomentum, SpellPierce],
    // Physical — martial brute. Pure reuse of existing generic martial passives.
    physical: [KeenEdge, Toughness, Bloodthirst, Thorns, Opportunist],
    // Earth — immovable defender (armor / block / magic-resist / endurance / last-stand).
    earth: [Toughness, Deflection, SteelMind, Survivalist, WarriorEnrage],
    // Wind — agile skirmisher (mobility / dodge-payoff / cooldown-speed / kinetic / precision).
    wind: [FleetFooted, Adrenaline, FastHands, Momentum, EagleEye],
    // Fire — burning caster (power / Burning-synergy / retaliation / spread / sustain).
    fire: [Kindle, Combustion, Immolation, Cinder, Emberheart],
    // Frost — control caster (Slow-synergy / retaliation / spread / ward / sustain).
    frost: [BitterCold, Rimeguard, ColdSnap, Frostshield, Icebound],
    // Poison — attrition assassin (Poison-synergy / retaliation / spread / power / drain).
    poison: [Virulence, VenomousSkin, Contagion, NoxiousMight, Parasite],
    // Acid — siege / armor-melt (Acid-synergy / retaliation / spread / penetration / sustain).
    acid: [Etch, CausticSkin, Meltdown, Solvent, CorrosiveVigor],
    // Lightning — aggressive burst (Shock-synergy / retaliation / spread / power / sustain).
    lightning: [Overload, StaticField, ChainReaction, Galvanize, Stormheart],
}

// --- Advanced-tier fixed base passives (one strong trait each; no pool) ---------
class CurseCorruption extends Passive {
    name = 'Deepening Corruption'; icon = 0
    description = 'Passive (Curse): feeds on kills — rising power (and desperation as HP falls) at the cost of ever-worsening healing. A held Cursed Gem withers CON/SPD/DEX in exchange for more power.'
    tags = [curseCorruption]
}
class Radiance extends Passive {
    name = 'Radiance'; icon = 0
    description = 'Passive (Light): restoration — regenerate HP each turn.'
    tags = [radiance]
}
class Oblivion extends Passive {
    name = 'Oblivion'; icon = 0
    description = 'Passive (Void): your damage unmakes defenses — ignores some of the target\'s armor and barrier.'
    tags = [oblivion]
}
class Aegis extends Passive {
    name = 'Aegis'; icon = 0
    description = 'Passive (Holy): a divine ward — take less damage from all sources.'
    tags = [aegis]
}
class SeraphicGrace extends Passive {
    name = 'Seraphic Grace'; icon = 0
    description = 'Passive (Seraphic): peak Light — regenerate HP each turn AND take less damage.'
    tags = [seraphicGrace]
}

// Advanced-tier fixed base passive (stronger; no pool). Demonic = Devour;
// Curse = Deepening Corruption; the cosmic four each get one strong trait.
export const ADVANCED_BASE_PASSIVE = {
    demonic: Devour,
    curse: CurseCorruption,
    light: Radiance,
    void: Oblivion,
    holy: Aegis,
    seraphic: SeraphicGrace,
}

export function basicPassivePool(key) {
    return BASIC_PASSIVE_POOLS[key] || []
}

export function advancedBasePassive(key) {
    return ADVANCED_BASE_PASSIVE[key] || null
}

// A random Passive class from the basic affinity's pool (common essence path).
// Math.random is fine here — game code, not a workflow script. null if no pool yet.
export function rollBasicPassive(key) {
    const pool = basicPassivePool(key)
    if (!pool.length) return null
    return pool[Math.floor(Math.random() * pool.length)]
}

// `count` distinct random Passive classes for the rare-essence DRAFT (pick 1 of N).
// Returns up to min(count, pool size) without repeats; [] if the affinity has no pool.
export function draftBasicPassives(key, count = 3) {
    const pool = basicPassivePool(key).slice()
    const out = []
    while (pool.length && out.length < count) {
        out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
    }
    return out
}

// Probe a Passive class for its display fields (the base ctor only sets `this.entity`,
// so a null-hero probe is safe). Carries the class back for the picker to apply.
export function describePassive(PassiveClass) {
    if (!PassiveClass) return null
    let probe = null
    try { probe = new PassiveClass(null) } catch { /* defensive — fall back to ctor name */ }
    return {
        PassiveClass,
        name: probe?.name || PassiveClass.name,
        icon: probe?.icon ?? 0,
        description: probe?.description || '',
    }
}

// Described draft options (name/icon/description + PassiveClass) for the rare-essence
// DraftScreen. [] when the affinity has no pool yet.
export function draftBasicPassiveOptions(key, count = 3) {
    return draftBasicPassives(key, count).map(describePassive).filter(Boolean)
}
