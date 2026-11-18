import Dash from "../abilities/Dash.js"
import PiercingLoose from "../abilities/PiercingLoose.js"
import Root from "../abilities/Root.js"
import Stealth from "../abilities/Stealth.js"
import Sense from "../abilities/Sense.js"
import RainOfTalons from "../abilities/RainOfTalons.js"

// Middle of the pack on HP. High DEX/SPD shape an evasion-and-range identity —
// dodge chance scales off (DEX+SPD)/4. No class armor base.
//
// The kit came over intact: Dash (mobility) + PiercingLoose (the bow opener) +
// Root (control) + Stealth (disengage). Sense (scouting) joined them 2026-09-10
// as the fifth (scope doc §10.6) — FogOfWar was already checking for its tag,
// so only the tag and the ability were missing. v3 also gave
// it the Tame passive, which grants a pet and needs the follower system cut in
// scope doc section 6. Its RainOfTalons ultimate came back on 2026-09-10 (scope
// doc section 10.5).
//
// Called the Elf in v3 and for the first weeks of v5 — renamed to Ranger, which
// names the role rather than a species and matches the art the class has always
// used (classes/ranger_south.png).

export default {
    name: "Ranger",
    tile: 79,
    art: { sheet: "heroes", file: "classes/ranger_south.png" },
    stats: { STR: 10, DEX: 15, CON: 10, SPD: 15, INT: 10, Magic: 10 },
    hpFormula: (s) => 365 + s.CON * 20,
    startingItems: ['bow'],
    abilities: [Dash, PiercingLoose, Root, Stealth, Sense],
    // Ultimate — lands in the dedicated R slot via BaseHero.applyProfile.
    ultimate: RainOfTalons,
    passives: [],
    tags: [],
}
