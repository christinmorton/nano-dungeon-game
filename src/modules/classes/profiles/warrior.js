import Cleave from "../abilities/Cleave.js"
import Charge from "../abilities/Charge.js"
import Bulwark from "../abilities/Bulwark.js"
import MightyBlow from "../abilities/MightyBlow.js"
import Shove from "../abilities/Shove.js"
import TheReaving from "../abilities/TheReaving.js"

// Soldier, not tank — high STR/CON, no magic. Wears CON-derived armor
// (classArmorBase override). HP formula matches the BaseHero default; declared
// explicitly so the profile reads as self-contained.
//
// The kit is Cleave (AoE) + Charge (gap-close) + Bulwark (defensive) +
// MightyBlow (single-target burst) + Shove (positional control) — five roles,
// no overlap. Shove was added 2026-09-10 (scope doc §10.6) and took the slot
// v3 gave to Breach, which is built on the destructible-wall primitive cut in
// §6. It was picked over the rest of v3's Warrior pool because it needs no new
// status, and because four damage-and-defence tools had no way to move anyone.
// v3 also carried
// Breach, which needs the destructible-wall primitive v5 does not have, and
// WarriorEnrage, a second self-buff sitting next to Bulwark. The lean-start
// starterAbility and the draftPool belong to systems cut in scope doc section 6.
// The TheReaving ultimate came back on 2026-09-10 (scope doc section 10.5).

export default {
    name: "Warrior",
    tile: 31,
    art: { sheet: "heroes", file: "classes/warrior_south.png" },
    stats: { STR: 15, DEX: 10, CON: 15, SPD: 10, INT: 5, Magic: 5 },
    hpFormula: (s) => 300 + s.CON * 20,
    classArmorBase: (s) => Math.floor(s.CON / 5),
    startingItems: ['sword'],
    abilities: [Cleave, Charge, Bulwark, MightyBlow, Shove],
    // Ultimate — lands in the dedicated R slot via BaseHero.applyProfile.
    ultimate: TheReaving,
    passives: [],
    tags: [],
}
