import Cleave from "../abilities/Cleave.js"
import Charge from "../abilities/Charge.js"
import Bulwark from "../abilities/Bulwark.js"
import Breach from "../abilities/Breach.js"
import MightyBlow from "../abilities/MightyBlow.js"
import TheReaving from "../abilities/TheReaving.js"
import WarriorEnrage from "../abilities/WarriorEnrage.js"

// Soldier, not tank — high STR/CON, no magic. Wears CON-derived armor
// (Warrior/Dwarf classArmorBase override). HP formula matches the
// BaseHero default; declared explicitly so the profile reads as
// self-contained.
// 5th slot is Mighty Blow (single-target burst — the de-WoW rename of Power
// Strike), rounding out Cleave's AOE + Charge's gap-close. The debug Placeholder
// was removed (Placeholder.js stays on disk as a status tester).

export default {
    name: "Warrior",
    tile: 31,
    art: { sheet: "heroes", file: "classes/warrior_south.png" },
    stats: { STR: 15, DEX: 10, CON: 15, SPD: 10, INT: 5, Magic: 5 },
    hpFormula: (s) => 300 + s.CON * 20,
    classArmorBase: (s) => Math.floor(s.CON / 5),
    startingItems: ['sword'],
    abilities: [Cleave, Charge, Bulwark, Breach, MightyBlow],
    // Lean-start (§14): the one ability you begin a build-your-own run with; the
    // rest of the kit is reachable via the draft pool below.
    starterAbility: Cleave,
    // Role pool for the milestone draft (§14 B5/B6) — martial picks + the displaced kit.
    draftPool: ['Charge', 'Bulwark', 'Breach', 'MightyBlow', 'Bludgeon', 'WarCry', 'Shove', 'BullRush', 'Brace', 'ComboStrike', 'Hamstring', 'Slash'],
    ultimate: TheReaving,
    passives: [WarriorEnrage]
}
