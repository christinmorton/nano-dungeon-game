import HealthPotion from "../../items/HealthPotion.js"
import Potion from "../../items/Potion.js"
import FrostBolt from "../abilities/FrostBolt.js"
import Barrier from "../abilities/Barrier.js"
import ArcLightning from "../abilities/ArcLightning.js"
import Blink from "../abilities/Blink.js"
import GaleWall from "../abilities/GaleWall.js"
import TheUnraveling from "../abilities/TheUnraveling.js"

// Lowest HP and no class armor base — squishy by design. INT and Magic
// both high (the spellcaster pairing per the design memo). Scroll
// auto-equips into mainhand; the two potions stay in carry since they
// have no slot.
//
// startingItems mixes profile-name strings (for the scroll, which is a
// profile-based RangedWeapon) with class refs (for the potions, which
// remain real classes). BaseHero.applyProfile handles both forms.

export default {
    name: "Wizard",
    classType: "caster",
    tile: 73,
    art: { sheet: "heroes", file: "classes/wizard_south.png" },
    stats: { STR: 5, DEX: 10, CON: 5, SPD: 5, INT: 15, Magic: 15 },
    hpFormula: (s) => 290 + s.CON * 30,
    startingItems: ['scrollOfFireball', HealthPotion, Potion],
    // Gale Wall takes the E slot — the wind-displacement evolution of the old
    // Force Push knockback. Blink restored at S. Fire Wall unslotted for now
    // (held for the final caster wall loadout / spell-selection screen).
    // (Barrier at W now resists both physical and magic — the absorb-slice update.
    // Debug benches SummonAlly / Ward are unslotted; re-add to test in-game.)
    abilities: [FrostBolt, Barrier, GaleWall, ArcLightning, Blink],
    // Lean-start (§14): the one ability a build-your-own run begins with.
    starterAbility: FrostBolt,
    // Role pool for the milestone draft (§14 B5/B6) — arcane picks + the displaced kit.
    draftPool: ['Barrier', 'GaleWall', 'ArcLightning', 'Blink', 'Fireball', 'MagicMissile', 'ArcaneBeam', 'FrostNova', 'Blizzard', 'IceShard', 'Telekinesis', 'ArcaneBarrage'],
    ultimate: TheUnraveling,
    tags: []
}
