import HealthPotion from "../../items/HealthPotion.js"
import Potion from "../../items/Potion.js"
import FrostBolt from "../abilities/FrostBolt.js"
import Barrier from "../abilities/Barrier.js"
import ArcLightning from "../abilities/ArcLightning.js"
import Blink from "../abilities/Blink.js"
import ManaBeam from "../abilities/ManaBeam.js"
import TheUnraveling from "../abilities/TheUnraveling.js"

// Lowest HP and no class armor base — squishy by design. INT and Magic both high.
// The scroll auto-equips into mainhand; the two potions stay in carry since they
// have no slot.
//
// startingItems mixes profile-name strings (the scroll, a profile-based
// RangedWeapon) with class refs (the potions, which are real classes).
// BaseHero.applyProfile handles both forms.
//
// The kit is FrostBolt (filler) + Barrier (defensive) + ArcLightning (AoE
// spreader) + Blink (mobility) + ManaBeam (a charged, piercing energy lance —
// the only charged cast in the game). Mana Beam was added 2026-09-10 as the
// fifth (scope doc §10.6); it took the slot v3 gave to GaleWall, which needs
// the wall primitive v5 does not have. Its TheUnraveling ultimate came back on
// 2026-09-10 (scope doc section 10.5).

export default {
    name: "Wizard",
    classType: "caster",
    tile: 73,
    art: { sheet: "heroes", file: "classes/wizard_south.png" },
    stats: { STR: 5, DEX: 10, CON: 5, SPD: 5, INT: 15, Magic: 15 },
    hpFormula: (s) => 290 + s.CON * 30,
    startingItems: ['scrollOfFireball', HealthPotion, Potion],
    abilities: [FrostBolt, Barrier, ArcLightning, Blink, ManaBeam],
    // Ultimate — lands in the dedicated R slot via BaseHero.applyProfile.
    ultimate: TheUnraveling,
    passives: [],
    tags: [],
}
