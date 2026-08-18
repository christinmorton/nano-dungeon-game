import Dash from "../abilities/Dash.js"
import PiercingLoose from "../abilities/PiercingLoose.js"
import Root from "../abilities/Root.js"
import Stealth from "../abilities/Stealth.js"
import Tame from "../abilities/Tame.js"
import RainOfTalons from "../abilities/RainOfTalons.js"

// Middle of the pack on HP. High DEX/SPD shape an evasion-and-range
// identity — dodge chance scales off (DEX+SPD)/4. No class armor base.
//
// The Elf is the ranger/tamer (art = ranger_south.png). Tame is now a PASSIVE (the
// tamer aptitude) — it grants the Tame Beast ability and the one-pet bond. It is
// UNGATED / universal (any hero or enemy can carry it); the Elf just slots it by
// default as the natural ranger-tamer. (Its old active S slot frees up — restore
// Sense or another ability there if desired.)

export default {
    name: "Elf",
    tile: 79,
    art: { sheet: "heroes", file: "classes/ranger_south.png" },
    stats: { STR: 10, DEX: 15, CON: 10, SPD: 15, INT: 10, Magic: 10 },
    hpFormula: (s) => 365 + s.CON * 20,
    startingItems: ['bow'],
    abilities: [Dash, PiercingLoose, Root, Stealth],
    // Lean-start (§14): Piercing Loose is the bow opener; mobility/utility via draft.
    starterAbility: PiercingLoose,
    // Role pool for the milestone draft (§14 B5/B6) — ranger picks + the displaced kit.
    draftPool: ['Dash', 'Root', 'Stealth', 'BarbedArrow', 'RapidShot', 'Splitshot', 'Deadeye', 'SnareShot', 'HuntersMark', 'Caltrops', 'ConcussiveShot'],
    ultimate: RainOfTalons,
    passives: [Tame],
    tags: []
}
