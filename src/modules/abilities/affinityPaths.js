// affinityPaths.js — the PATH-CONTENT layer for the affinity upgrade tree (§19).
//
// Each affinity's "signature empowerment" forks into ~3 thematic paths (an offense /
// damage / defense triangle). A path is a Passive the hero attaches by spending
// affinity shards; deepening a path bumps a rank that the path's tag reads LIVE, so
// investment scales the effect without re-attaching. Seraphic is the worked template
// (the first affinity given paths); the other 14 follow the same mold.
//
// Kept SEPARATE from combat-critical affinities.js (which Combat/universals import) to
// avoid an affinities↔universals cycle, and OUTSIDE classes/abilities/ so the ability-
// registry glob never enumerates these as learnable abilities — exactly like
// affinityPassives.js.

import Passive from '../classes/abilities/Passive.js'
import ascendance, { ascendanceReadout } from '../tags/ascendance.js'
import { twilightBrander, twilightReadout } from '../tags/twilightBrand.js'
import veil, { veilReadout } from '../tags/veil.js'
import theUnmaking, { unmakingReadout } from '../tags/theUnmaking.js'
import theSilence, { silenceReadout } from '../tags/theSilence.js'
import theHunger, { hungerReadout } from '../tags/theHunger.js'
import wrath, { wrathReadout } from '../tags/wrath.js'
import ravening, { raveningReadout } from '../tags/ravening.js'
import dread, { dreadReadout } from '../tags/dread.js'
import unveiling, { unveilingReadout } from '../tags/unveiling.js'
import mending, { mendingReadout } from '../tags/mending.js'
import { zenith, zenithReadout } from '../tags/zenith.js'
import judgment, { judgmentReadout } from '../tags/judgment.js'
import sanctuary, { sanctuaryReadout } from '../tags/sanctuary.js'
import consecration, { consecrationReadout } from '../tags/consecration.js'
import { BASIC_SIGNATURES } from '../tags/affinitySignatures.js'
// Empowered basic (demi-god) trees — one per patron beast.
import { weave, weaveReadout, unweaving, unweaveReadout, warding, wardReadout } from '../tags/empoweredArcane.js'
import { mountainguard, mountainguardReadout, tremor, tremorReadout, endurance, enduranceReadout } from '../tags/empoweredEarth.js'
import { gale, galeReadout, swarm, swarmReadout, squall, squallReadout } from '../tags/empoweredWind.js'
import { venom, venomReadout, constrict, constrictReadout, shed, shedReadout } from '../tags/empoweredPoison.js'
import { corrode, corrodeReadout, famine, famineReadout, rot, rotReadout } from '../tags/empoweredAcid.js'
import { valor, valorReadout, undying, undyingReadout, renown, renownReadout } from '../tags/empoweredPhysical.js'

// Cap on how deep a single path can be invested. Escalating shard cost lives in the
// UpgradeScreen (tuning), the same split as empowerShardCost.
export const MAX_PATH_RANK = 3

// --- Seraphic — the worked template (3 paths) --------------------------------
class Ascendance extends Passive {
    name = 'Ascendance'; icon = 0
    description = 'Path (Seraphic): unbound power — each kill deepens your radiance (bonus outgoing damage), building with no master to cap it.'
    tags = [ascendance]
}
class TwilightBrand extends Passive {
    name = 'Twilight Brand'; icon = 0
    description = 'Path (Seraphic): your strikes brand foes with twilight — unblockable radiant damage over time that neither Light nor Void can turn aside.'
    tags = [twilightBrander]
}
class Veil extends Passive {
    name = 'the Veil'; icon = 0
    description = 'Path (Seraphic): a veiled seraph is hard to strike (evasion), and a blow that lands is answered by a hidden radiance the attacker never saw.'
    tags = [veil]
}

// --- Void (cosmic) — the three faces of the end (§19.6) ----------------------
class TheUnmaking extends Passive {
    name = 'The Unmaking'; icon = 0
    description = 'Path (Void): the entropy that dissolves the made — your damage ignores ever more of the target\'s armor and barrier.'
    tags = [theUnmaking]
}
class TheSilence extends Passive {
    name = 'The Silence'; icon = 0
    description = 'Path (Void): erasure — every hit un-writes the target, tearing away its buffs, weakening and silencing it.'
    tags = [theSilence]
}
class TheHunger extends Passive {
    name = 'The Hunger'; icon = 0
    description = 'Path (Void): the devouring maw — a slain foe is consumed, healing you and wrapping you in a void-shield of its essence.'
    tags = [theHunger]
}

// --- Demonic (cosmic) — Void given hunger and horns (§19.6) -------------------
class Wrath extends Passive {
    name = 'Wrath'; icon = 0
    description = 'Path (Demonic): the cornered demon rages — your outgoing damage climbs the lower your own HP falls.'
    tags = [wrath]
}
class Ravening extends Passive {
    name = 'Ravening'; icon = 0
    description = 'Path (Demonic): the hunger deepened — every blow you land drinks life, healing you a share of the damage dealt.'
    tags = [ravening]
}
class Dread extends Passive {
    name = 'Dread'; icon = 0
    description = 'Path (Demonic): terror — your strikes Weaken the struck and may grip them with Fear.'
    tags = [dread]
}

// --- Light (cosmic) — revelation, restoration, and the merciless Zenith (§19.6) --
class TheUnveiling extends Passive {
    name = 'The Unveiling'; icon = 0
    description = 'Path (Light): revelation — every hit exposes the target (Marked + Illuminated), and you strike the exposed harder.'
    tags = [unveiling]
}
class TheMending extends Passive {
    name = 'The Mending'; icon = 0
    description = 'Path (Light): restoration — each round mends you AND your whole living party.'
    tags = [mending]
}
class TheZenith extends Passive {
    name = 'The Zenith'; icon = 0
    description = 'Path (Light): the merciless cleanse — every hit brands the target with an unblockable radiant burn.'
    tags = [zenith]
}

// --- Holy (cosmic) — Light embodied: the judgment of angels (§19.6) ----------
class Judgment extends Passive {
    name = 'Judgment'; icon = 0
    description = 'Path (Holy): the angel\'s smite — every hit calls radiant judgment (Smitten), and you strike the unholy harder.'
    tags = [judgment]
}
class Sanctuary extends Passive {
    name = 'Sanctuary'; icon = 0
    description = 'Path (Holy): the divine ward — you take less damage from all sources and are knit back together each round.'
    tags = [sanctuary]
}
class Consecration extends Passive {
    name = 'Consecration'; icon = 0
    description = 'Path (Holy): holy ground — a barrier of blessed light wards you, and any foe that strikes you is judged (Smitten).'
    tags = [consecration]
}

// --- Basic affinities — SIMPLE tier (§19.6) ----------------------------------
// A PLAIN basic gets ONE deepen-able signature node (from affinitySignatures.js); an
// EMPOWERED basic (affinityBasicTier>0, a mythical-beast boon) unlocks its demi-god
// 3-path fork instead. Wrap each signature tag in a Passive so investAffinityPath
// attaches it exactly like a deep-tier path.
function signatureDef(sig) {
    const SigPassive = class extends Passive {
        constructor(entity) {
            super(entity)
            this.name = sig.label
            this.description = `Signature (${sig.label}): ${sig.blurb}`
            this.tags = [sig.tag]
        }
    }
    return { key: sig.key, label: sig.label, PassiveClass: SigPassive, blurb: sig.blurb, readout: sig.readout }
}

// element -> { simple: [1 signature], empowered: [3-path demi-god fork] }. The empowered
// forks (patron-beast trees) land in the next pass; until then an empowered basic falls
// back to its simple node (see affinityPathsFor).
const BASIC_PATHS = {}
for (const [element, sig] of Object.entries(BASIC_SIGNATURES)) {
    BASIC_PATHS[element] = { simple: [signatureDef(sig)], empowered: [] }
}

// Wrap a rank-reading tag in a Passive (investAffinityPath attaches it). Used for the
// empowered demi-god forks, whose tags live one-file-per-beast in tags/empowered*.js.
function pathPassive(label, description, tag) {
    return class extends Passive {
        constructor(entity) { super(entity); this.name = label; this.description = description; this.tags = [tag] }
    }
}
const epath = (key, label, description, tag, blurb, readout) =>
    ({ key, label, PassiveClass: pathPassive(label, description, tag), blurb, readout })

// The demi-god forks (unlocked when the basic is empowered — a patron beast's boon).
BASIC_PATHS.arcane.empowered = [
    epath('weave', 'Overchannel', 'Path (Arcane / First Weaver): raw magic mastered — more magic power.', weave, 'Power — raw magic.', weaveReadout),
    epath('unweave', 'Unweaving', 'Path (Arcane / First Weaver): pierce barrier and unravel a boon on every hit.', unweaving, 'Unravel — pierce + dispel.', unweaveReadout),
    epath('ward', 'Warding', 'Path (Arcane / First Weaver): a woven barrier that lashes back at attackers.', warding, 'Ward — barrier + backlash.', wardReadout),
]
BASIC_PATHS.earth.empowered = [
    epath('mountainguard', 'Mountainguard', 'Path (Earth / Mountain\'s Tooth): the immovable mountain — far less damage taken + stone armor.', mountainguard, 'Guard — heavy DR + armor.', mountainguardReadout),
    epath('tremor', 'Tremor', 'Path (Earth / Mountain\'s Tooth): the mountain\'s blow staggers — a chance to Stun on hit.', tremor, 'Stagger — chance to Stun.', tremorReadout),
    epath('endure', 'Endurance', 'Path (Earth / Mountain\'s Tooth): the mountain endures — knit back together each round.', endurance, 'Endure — strong regen.', enduranceReadout),
]
BASIC_PATHS.wind.empowered = [
    epath('gale', 'Gale', 'Path (Wind / Hollow Swarm): ride the storm — near-impossible to strike.', gale, 'Evade — heavy dodge.', galeReadout),
    epath('swarm', 'Swarm', 'Path (Wind / Hollow Swarm): a thousand bites — every blow lands an extra sting.', swarm, 'Bite — bonus damage per hit.', swarmReadout),
    epath('squall', 'Squall', 'Path (Wind / Hollow Swarm): buffeting winds Slow whatever you strike.', squall, 'Scatter — Slow on hit.', squallReadout),
]
BASIC_PATHS.poison.empowered = [
    epath('venom', 'Venom', 'Path (Poison / Old Coil): envenom every strike and savage the poisoned.', venom, 'Envenom — Poison + synergy.', venomReadout),
    epath('constrict', 'Constrict', 'Path (Poison / Old Coil): the serpent\'s coils Slow the prey and drain its life.', constrict, 'Coil — Slow + drain.', constrictReadout),
    epath('shed', 'Shed', 'Path (Poison / Old Coil): poisoned skin envenoms strikers as it renews.', shed, 'Skin — retaliate + regen.', shedReadout),
]
BASIC_PATHS.acid.empowered = [
    epath('corrode', 'Corrode', 'Path (Acid / Grey Famine): dissolve defenses and coat every hit in eating acid.', corrode, 'Dissolve — pierce + Acid.', corrodeReadout),
    epath('famine', 'Famine', 'Path (Acid / Grey Famine): the wither of starvation — Weaken + Frailty on hit.', famine, 'Wither — Weaken + Frailty.', famineReadout),
    epath('rot', 'Rot', 'Path (Acid / Grey Famine): spreading decay — a withering Blight on every strike.', rot, 'Decay — Blight on hit.', rotReadout),
]
BASIC_PATHS.physical.empowered = [
    epath('valor', 'Valor', 'Path (Physical / The Undying): the mythic champion\'s might — every blow strikes truer.', valor, 'Might — more damage.', valorReadout),
    epath('undying', 'Undying', 'Path (Physical / The Undying): the legend that will not fall — harder to wound, renewed by a kill.', undying, 'Legend — DR + heal on kill.', undyingReadout),
    epath('renown', 'Renown', 'Path (Physical / The Undying): lives on through myth — heartens the whole party.', renown, 'Myth — party regen.', renownReadout),
]

// Per-affinity path forks. Advanced affinities are a flat array (always the deep fork);
// basics are { simple, empowered } gated on empowerment. `blurb` = one-line lane summary.
export const AFFINITY_PATHS = {
    ...BASIC_PATHS,
    seraphic: [
        { key: 'ascendance', label: 'Ascendance', PassiveClass: Ascendance, blurb: 'Grow — unbound escalation on kills.', readout: ascendanceReadout },
        { key: 'twilight', label: 'Twilight Brand', PassiveClass: TwilightBrand, blurb: 'Pierce — unblockable twilight DoT on hit.', readout: twilightReadout },
        { key: 'veil', label: 'the Veil', PassiveClass: Veil, blurb: 'Vanish — evasion + hidden backlash.', readout: veilReadout },
    ],
    void: [
        { key: 'unmaking', label: 'The Unmaking', PassiveClass: TheUnmaking, blurb: 'Negate — dissolve armor & barrier.', readout: unmakingReadout },
        { key: 'silence', label: 'The Silence', PassiveClass: TheSilence, blurb: 'Erase — strip buffs, weaken, silence.', readout: silenceReadout },
        { key: 'hunger', label: 'The Hunger', PassiveClass: TheHunger, blurb: 'Consume — kills heal + shield you.', readout: hungerReadout },
    ],
    demonic: [
        { key: 'wrath', label: 'Wrath', PassiveClass: Wrath, blurb: 'Rage — more damage as HP falls.', readout: wrathReadout },
        { key: 'ravening', label: 'Ravening', PassiveClass: Ravening, blurb: 'Hunger — lifesteal on every hit.', readout: raveningReadout },
        { key: 'dread', label: 'Dread', PassiveClass: Dread, blurb: 'Terror — Weaken + Fear on hit.', readout: dreadReadout },
    ],
    light: [
        { key: 'unveiling', label: 'The Unveiling', PassiveClass: TheUnveiling, blurb: 'Reveal — expose foes, hit them harder.', readout: unveilingReadout },
        { key: 'mending', label: 'The Mending', PassiveClass: TheMending, blurb: 'Restore — regen self + party.', readout: mendingReadout },
        { key: 'zenith', label: 'The Zenith', PassiveClass: TheZenith, blurb: 'Burn — unblockable radiant DoT on hit.', readout: zenithReadout },
    ],
    holy: [
        { key: 'judgment', label: 'Judgment', PassiveClass: Judgment, blurb: 'Smite — radiant judgment, +vs unholy.', readout: judgmentReadout },
        { key: 'sanctuary', label: 'Sanctuary', PassiveClass: Sanctuary, blurb: 'Ward — less damage taken + regen.', readout: sanctuaryReadout },
        { key: 'consecration', label: 'Consecration', PassiveClass: Consecration, blurb: 'Holy ground — barrier + punish strikers.', readout: consecrationReadout },
    ],
}

// Every def for an affinity, regardless of tier — for lookup by key (keys are globally
// unique, so a key resolves whether it's a simple signature or an empowered path).
function allDefsFor(affinityKey) {
    const entry = AFFINITY_PATHS[affinityKey]
    if (!entry) return []
    if (Array.isArray(entry)) return entry
    return [...(entry.simple || []), ...(entry.empowered || [])]
}

// The paths to OFFER for an affinity. Advanced = its flat fork. Basic = the empowered
// demi-god fork when `empowered` AND that fork exists, else the plain simple signature
// (so an empowered basic never shows an empty list before its patron tree is built).
export function affinityPathsFor(affinityKey, empowered = false) {
    const entry = AFFINITY_PATHS[affinityKey]
    if (!entry) return []
    if (Array.isArray(entry)) return entry
    return (empowered && entry.empowered?.length) ? entry.empowered : (entry.simple || [])
}

export function affinityPathDef(affinityKey, pathKey) {
    return allDefsFor(affinityKey).find(p => p.key === pathKey) || null
}

// Is `pathKey` one of the affinity's EMPOWERED (demi-god) paths? Used to gate investment
// behind empowerment so a plain basic can't buy into the deep tree.
export function isEmpoweredPath(affinityKey, pathKey) {
    const entry = AFFINITY_PATHS[affinityKey]
    if (!entry || Array.isArray(entry)) return false
    return (entry.empowered || []).some(p => p.key === pathKey)
}

// Does this affinity have any empowerment paths at all?
export function hasAffinityPaths(affinityKey) {
    return allDefsFor(affinityKey).length > 0
}
