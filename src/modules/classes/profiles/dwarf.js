import Stomp from "../abilities/Stomp.js"
import SecondWind from "../abilities/SecondWind.js"
import HurlWeapon from "../abilities/HurlWeapon.js"
import Dig from "../abilities/Dig.js"
import EarthWall from "../abilities/EarthWall.js"
import Mountainfall from "../abilities/Mountainfall.js"
import Toughness from "../abilities/Toughness.js"

// Tank — highest HP curve in the roster, CON-derived armor. Mid Magic
// reflects innate runic magic without scholarly INT (see design memo) — which
// is what the S-slot Earth Wall draws on (runic stoneshaping, alongside Dig).
// PROVISIONAL: Earth Wall here is the testbed for the `wall` universal; swap for
// Bludgeon / a super later per the encyclopedia plan if preferred.

export default {
    name: "Dwarf",
    tile: 122,
    art: { sheet: "32rogues-rogues", frame: 0 },
    stats: { STR: 15, DEX: 5, CON: 15, SPD: 5, INT: 5, Magic: 10 },
    hpFormula: (s) => 350 + s.CON * 30,
    classArmorBase: (s) => Math.floor(s.CON / 5),
    startingItems: ['axe', 'shield'],
    abilities: [Stomp, SecondWind, HurlWeapon, Dig, EarthWall],
    // Lean-start (§14): Stomp is the reliable opener; Hurl Weapon (Dwarf signature)
    // and the rest are reachable via draft.
    starterAbility: Stomp,
    // Role pool for the milestone draft (§14 B5/B6) — earth/stout picks + the displaced kit.
    draftPool: ['SecondWind', 'HurlWeapon', 'Dig', 'EarthWall', 'Stoneskin', 'Bulwark', 'StonePillar', 'Tremor', 'Shove', 'Bludgeon', 'Brace', 'Shatter'],
    ultimate: Mountainfall,
    passives: [Toughness],
    tags: []
}
