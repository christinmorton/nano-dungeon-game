// Every status-effect tag template, grouped by category. Importing this
// module runs each tag's defineStatus call, which registers its metadata
// in the Status registry — so pulling in statusList also makes the full
// catalog enumerable for Cleanse/Dispel and the status HUD. The Placeholder
// status-tester ability draws its cycle order from the default export.

// Buffs
import might from "./might.js"
import barrier from "./barrier.js"
import regen from "./regen.js"
import bulwark from "./bulwark.js"
import invisible from "./invisible.js"
import sense from "./sense.js"
import clericRegen from "./clericRegen.js"
import warriorEnrage from "./warriorEnrage.js"
import haste from "./haste.js"
import extendedReach from "./extendedReach.js"
import shield from "./shield.js"
import emboldened from "./emboldened.js"
import counter from "./counter.js"
import aim from "./aim.js"
import focus from "./focus.js"
import ascended from "./ascended.js"
import ascendance from "./ascendance.js"
import veil from "./veil.js"
import theUnmaking from "./theUnmaking.js"
import theSilence from "./theSilence.js"
import theHunger from "./theHunger.js"
import wrath from "./wrath.js"
import ravening from "./ravening.js"
import dread from "./dread.js"
import unveiling from "./unveiling.js"
import mending from "./mending.js"
import { zenith } from "./zenith.js"
import judgment from "./judgment.js"
import sanctuary from "./sanctuary.js"
import consecration from "./consecration.js"

// Debuffs
import cursed from "./cursed.js"
import slow from "./slow.js"
import weaken from "./weaken.js"
import sunder from "./sunder.js"
import corrosion from "./corrosion.js"
import blind from "./blind.js"
import mark from "./mark.js"
import marked from "./marked.js"
import aura from "./aura.js"
import shocked from "./shocked.js"
import illuminated from "./illuminated.js"
import unmaking from "./unmaking.js"
import damned from "./damned.js"

// Damage over time
import burning from "./burning.js"
import poison from "./poison.js"
import bleed from "./bleed.js"
import blight from "./blight.js"
import acid from "./acid.js"
import corruption from "./corruption.js"
import smitten from "./smitten.js"
import twilightBrand from "./twilightBrand.js"
import zenithBurn from "./zenith.js"

// Crowd control
import stun from "./stun.js"
import rooted from "./rooted.js"
import freeze from "./freeze.js"
import stasis from "./stasis.js"
import sleep from "./sleep.js"
import silence from "./silence.js"
import taunt from "./taunt.js"

// Status alterations
import confuse from "./confuse.js"
import charm from "./charm.js"
import fear from "./fear.js"
import berserk from "./berserk.js"
import zombie from "./zombie.js"
import transform from "./transform.js"

// Turn & progression
import doom from "./doom.js"
import petrify from "./petrify.js"
import frailty from "./frailty.js"
import exhausted from "./exhausted.js"

// Spatial & environmental
import underground from "./underground.js"
import wet from "./wet.js"
import oilSlicked from "./oilSlicked.js"
import levitate from "./levitate.js"

// Shop & item
import greed from "./greed.js"
import corroded from "./corroded.js"
import volatile from "./volatile.js"
import midasTouch from "./midasTouch.js"

// Basic-affinity simple-tier signatures (one deepen-able node per plain basic).
import { BASIC_SIGNATURES } from "./affinitySignatures.js"
// Empowered basic (demi-god) fork tags — one file per patron beast.
import { weave, unweaving, warding } from "./empoweredArcane.js"
import { mountainguard, tremor, endurance } from "./empoweredEarth.js"
import { gale, swarm, squall } from "./empoweredWind.js"
import { venom, constrict, shed } from "./empoweredPoison.js"
import { corrode, famine, rot } from "./empoweredAcid.js"
import { valor, undying, renown } from "./empoweredPhysical.js"

const statusList = [
    might, barrier, regen, bulwark, invisible, sense, clericRegen, warriorEnrage, haste, extendedReach, shield, emboldened, counter, aura, aim, focus, ascended, ascendance, veil, theUnmaking, theSilence, theHunger, wrath, ravening, dread, unveiling, mending, zenith, judgment, sanctuary, consecration,
    cursed, slow, weaken, sunder, corrosion, blind, mark, marked, shocked, illuminated, unmaking, damned,
    burning, poison, bleed, blight, acid, corruption, smitten, twilightBrand, zenithBurn,
    stun, rooted, freeze, stasis, sleep, silence, taunt,
    confuse, charm, fear, berserk, zombie, transform,
    doom, petrify, frailty, exhausted,
    underground, wet, oilSlicked, levitate,
    greed, corroded, volatile, midasTouch,
    ...Object.values(BASIC_SIGNATURES).map(s => s.tag),
    weave, unweaving, warding, mountainguard, tremor, endurance, gale, swarm, squall,
    venom, constrict, shed, corrode, famine, rot, valor, undying, renown,
]

export default statusList
