import EarthBolt from "../abilities/EarthBolt.js"
import LightningBolt from "../abilities/LightningBolt.js"
import Heal from "../abilities/Heal.js"
import PrimalHound from "../abilities/PrimalHound.js"
import BedrockSentinel from "../abilities/BedrockSentinel.js"
import HealthPotion from "../../items/HealthPotion.js"
import Potion from "../../items/Potion.js"

// Shaman — the spirit/elemental summoner: the Shaman half of the Shaman/Tamer
// follower-owner role (the Tamer half attaches to the Elf). Commands summoned
// spirits and channels primal elements, and can mend the party (spirit healing).
//
// Art: the 32rogues "druid" sprite (rogues sheet). frame 30 = row 5.c by the
// sheet's frame math, but VERIFY it in test.html — the manifest's frame formula
// is approximate (see the verify-tiles-visually convention). Falls back to the
// Kenney tile if the frame/sheet doesn't resolve.

export default {
    name: "Shaman",
    // Own identity (not a generic caster). Currently a decorative marker — no
    // ability gates on classType after the §14 B1 soft-gating pass — but reserved
    // as a hook for spirit-themed draft pools / future shaman-exclusive content.
    classType: "shaman",
    tile: 73,
    art: { sheet: "32rogues-rogues", frame: 30 },
    stats: { STR: 8, DEX: 10, CON: 12, SPD: 10, INT: 13, Magic: 15 },
    hpFormula: (s) => 300 + s.CON * 25,
    startingItems: ['bow', HealthPotion, Potion],
    // Q Primal Hound, W Bedrock Sentinel, E Earth Bolt, A Levin Bolt, S Heal.
    abilities: [PrimalHound, BedrockSentinel, EarthBolt, LightningBolt, Heal],
    // Lean-start (§14): Earth Bolt is the reliable opener; summons/support via draft.
    starterAbility: EarthBolt,
    // Role pool for the milestone draft (§14 B5/B6) — spirit/elemental picks + the displaced kit.
    draftPool: ['PrimalHound', 'BedrockSentinel', 'LightningBolt', 'Heal', 'SpiritSurge', 'Gust', 'Tremor', 'StonePillar', 'CallStorm', 'Galecall', 'Updraft', 'Stoneskin', 'Conduct'],
    tags: []
}
