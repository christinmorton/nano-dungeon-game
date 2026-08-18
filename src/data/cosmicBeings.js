// Cosmic beings — the data table (one row per being) behind the CosmicBeing base
// class (modules/enemies/CosmicBeing.js). Identity + art + power + stats live here
// as DATA; the base class reads a row by key and applies it, and the enemy registry
// enumerates these keys + factory-spawns them (no per-being class file). Adding a
// being = one row here.
//
// See documents/v3_cosmic_hierarchy_and_entities.md for the hierarchy, the
// power-level chart, and the three-axis model. Fields:
//   name         — display name.
//   tier         — coarse depth band (feeds future spawn filtering).
//   powerLevel   — the raw individual-power number from the chart (design dial +
//                  future readout). INF for the two Principles only.
//   art          — { sheet, file } for the render path (assetLoader.resolveArt).
//   archetype    — combat AI archetype (only 'brute'/'hunter' used here — both proven).
//   kind         — parallel classification ('cosmic' | 'beast'); not a class hierarchy.
//   alignment    — DEFAULT team on spawn ('enemy' default; mutable at runtime via
//                  companions/allegiance.js — pacts flip it).
//   stats        — STR/DEX/CON/SPD/INT/Magic sheet (applyProfile).
//   hpFormula    — maxHP from stats.
//   weapon       — { name, damage: [min, max] }.

import { cosmic, monster } from "./enemyArt.js"

const INF = 999   // "infinite" — reserved for the two Principles.

export const COSMIC_PROFILES = {
    // ── Principles — infinite (the only two) ────────────────────────────────
    TheLight: {
        name: "The Light", tier: 7, powerLevel: INF, kind: "cosmic", archetype: "hunter",
        art: cosmic("light/light_first_light_alt.png"),
        stats: { STR: INF, DEX: INF, CON: INF, SPD: INF, INT: INF, Magic: INF },
        hpFormula: (s) => 600 + s.CON * 16, weapon: { name: "the first word", damage: [20, 30] },
    },
    TheVoid: {
        name: "The Void", tier: 7, powerLevel: INF, kind: "cosmic", archetype: "hunter",
        art: cosmic("void/void_the_hollow.png"),
        stats: { STR: INF, DEX: INF, CON: INF, SPD: INF, INT: INF, Magic: INF },
        hpFormula: (s) => 600 + s.CON * 16, weapon: { name: "the unmaking", damage: [20, 30] },
    },

    // ── Facsimiles ("ascended gods") — near-infinite, 700–900 ────────────────
    TheZenith: {
        name: "The Zenith", tier: 6, powerLevel: 880, kind: "cosmic", archetype: "hunter",
        art: cosmic("light/the_zenith.png"),
        stats: { STR: 58, DEX: 58, CON: 62, SPD: 54, INT: 72, Magic: 78 },
        hpFormula: (s) => 550 + s.CON * 15, weapon: { name: "the verdict", damage: [18, 28] },
    },
    TheJustice: {
        name: "The Justice", tier: 6, powerLevel: 820, kind: "cosmic", archetype: "hunter",
        art: cosmic("light/the_justice.png"),
        stats: { STR: 62, DEX: 56, CON: 64, SPD: 52, INT: 66, Magic: 70 },
        hpFormula: (s) => 550 + s.CON * 15, weapon: { name: "the scales", damage: [18, 26] },
    },
    TheMending: {
        name: "The Mending", tier: 6, powerLevel: 720, kind: "cosmic", archetype: "hunter",
        art: cosmic("light/the_mending.png"),
        stats: { STR: 48, DEX: 50, CON: 68, SPD: 50, INT: 64, Magic: 74 },
        hpFormula: (s) => 550 + s.CON * 15, weapon: { name: "mending light", damage: [14, 22] },
    },
    TheHunger: {
        name: "The Hunger", tier: 6, powerLevel: 860, kind: "cosmic", archetype: "hunter",
        art: cosmic("void/the_hunger.png"),
        stats: { STR: 74, DEX: 60, CON: 66, SPD: 58, INT: 48, Magic: 66 },
        hpFormula: (s) => 550 + s.CON * 15, weapon: { name: "the devouring maw", damage: [20, 30] },
    },
    TheSilence: {
        name: "The Silence", tier: 6, powerLevel: 780, kind: "cosmic", archetype: "hunter",
        art: cosmic("void/the_silence.png"),
        stats: { STR: 54, DEX: 64, CON: 58, SPD: 60, INT: 68, Magic: 72 },
        hpFormula: (s) => 550 + s.CON * 15, weapon: { name: "erasing touch", damage: [16, 26] },
    },

    // ── Demi-gods — 480–699 ──────────────────────────────────────────────────
    Archangel: {
        name: "Archangel", tier: 5, powerLevel: 640, kind: "cosmic", archetype: "brute",
        art: cosmic("holy/archangel.png"),
        stats: { STR: 38, DEX: 34, CON: 40, SPD: 32, INT: 38, Magic: 46 },
        hpFormula: (s) => 400 + s.CON * 13, weapon: { name: "gilded broadsword", damage: [13, 20] },
    },
    Seraphim: {
        name: "Seraphim", tier: 5, powerLevel: 660, kind: "cosmic", archetype: "hunter",
        art: cosmic("holy/seraphim.png"),
        stats: { STR: 34, DEX: 32, CON: 38, SPD: 30, INT: 40, Magic: 48 },
        hpFormula: (s) => 440 + s.CON * 14, weapon: { name: "blade of dawn", damage: [14, 21] },
    },
    DemonLord: {
        name: "Demon Lord", tier: 5, powerLevel: 690, kind: "cosmic", archetype: "hunter",
        art: cosmic("demons/demon_lord.png"),
        stats: { STR: 46, DEX: 36, CON: 44, SPD: 34, INT: 36, Magic: 44 },
        hpFormula: (s) => 440 + s.CON * 14, weapon: { name: "doomcleaver", damage: [16, 24] },
    },

    // ── Mythical / elemental demi-gods (bestial, free of Light/Void) ─────────
    FirstWeaver: {
        name: "The First Weaver", tier: 5, powerLevel: 520, kind: "beast", archetype: "hunter",
        art: monster("mythical/first_weaver_south.png"),
        stats: { STR: 34, DEX: 44, CON: 36, SPD: 40, INT: 20, Magic: 38 },
        hpFormula: (s) => 380 + s.CON * 13, weapon: { name: "weaving fangs", damage: [12, 19] },
    },
    GreyFamine: {
        name: "The Grey Famine", tier: 5, powerLevel: 560, kind: "beast", archetype: "hunter",
        art: monster("mythical/grey_famine_south.png"),
        stats: { STR: 38, DEX: 36, CON: 40, SPD: 34, INT: 24, Magic: 42 },
        hpFormula: (s) => 380 + s.CON * 13, weapon: { name: "withering touch", damage: [13, 20] },
    },
    HollowSwarm: {
        name: "The Hollow Swarm", tier: 5, powerLevel: 500, kind: "beast", archetype: "hunter",
        art: monster("mythical/hollow_swarm_south.png"),
        stats: { STR: 30, DEX: 46, CON: 34, SPD: 48, INT: 18, Magic: 36 },
        hpFormula: (s) => 380 + s.CON * 13, weapon: { name: "consuming swarm", damage: [11, 18] },
    },
    MountainsTooth: {
        name: "The Mountain's Tooth", tier: 5, powerLevel: 620, kind: "beast", archetype: "brute",
        art: monster("mythical/mountains_tooth_south.png"),
        stats: { STR: 52, DEX: 24, CON: 60, SPD: 22, INT: 20, Magic: 30 },
        hpFormula: (s) => 460 + s.CON * 15, weapon: { name: "avalanche maw", damage: [15, 24] },
    },
    OldCoil: {
        name: "Old Coil", tier: 5, powerLevel: 540, kind: "beast", archetype: "hunter",
        art: monster("mythical/old_coil_south.png"),
        stats: { STR: 44, DEX: 40, CON: 42, SPD: 38, INT: 22, Magic: 34 },
        hpFormula: (s) => 380 + s.CON * 13, weapon: { name: "crushing coils", damage: [13, 21] },
    },
    TheUndying: {
        name: "The Undying", tier: 5, powerLevel: 580, kind: "beast", archetype: "brute",
        art: monster("mythical/the_undying_south.png"),
        stats: { STR: 40, DEX: 30, CON: 50, SPD: 28, INT: 26, Magic: 40 },
        hpFormula: (s) => 440 + s.CON * 14, weapon: { name: "grave grasp", damage: [14, 22] },
    },

    // ── Servants — 275–425 ───────────────────────────────────────────────────
    HolyAngel: {
        name: "Holy Angel", tier: 4, powerLevel: 340, kind: "cosmic", archetype: "brute",
        art: cosmic("holy/angel.png"),
        stats: { STR: 24, DEX: 22, CON: 26, SPD: 20, INT: 26, Magic: 28 },
        hpFormula: (s) => 300 + s.CON * 12, weapon: { name: "radiant blade", damage: [8, 13] },
    },
    Demon: {
        name: "Demon", tier: 4, powerLevel: 400, kind: "cosmic", archetype: "hunter",
        art: cosmic("demons/demon.png"),
        stats: { STR: 32, DEX: 26, CON: 30, SPD: 24, INT: 28, Magic: 34 },
        hpFormula: (s) => 400 + s.CON * 14, weapon: { name: "hellforged claws", damage: [13, 19] },
    },

    // ── Lesser servants — 185–225 ────────────────────────────────────────────
    Cherub: {
        name: "Cherub", tier: 3, powerLevel: 200, kind: "cosmic", archetype: "hunter",
        art: cosmic("holy/lesser_angel.png"),
        stats: { STR: 14, DEX: 18, CON: 16, SPD: 18, INT: 18, Magic: 22 },
        hpFormula: (s) => 240 + s.CON * 10, weapon: { name: "radiant mote", damage: [5, 9] },
    },
    LesserDemon: {
        name: "Lesser Demon", tier: 3, powerLevel: 210, kind: "cosmic", archetype: "hunter",
        art: cosmic("demons/lesser_demon.png"),
        stats: { STR: 18, DEX: 16, CON: 16, SPD: 14, INT: 12, Magic: 16 },
        hpFormula: (s) => 250 + s.CON * 10, weapon: { name: "clawing hunger", damage: [6, 10] },
    },
}

// Every cosmic being key — the enemy registry merges these into the spawnable list.
export const COSMIC_KEYS = Object.keys(COSMIC_PROFILES)

// Resolve a name to a cosmic key (case-insensitive), or null.
export function cosmicKeyByName(name) {
    if (!name) return null
    if (COSMIC_PROFILES[name]) return name
    const lower = String(name).toLowerCase()
    return COSMIC_KEYS.find(k => k.toLowerCase() === lower) || null
}

// Which ADVANCED affinity a pact with each being binds (the pact system —
// see documents/v3_cosmic_hierarchy_and_entities.md §9 + v3_ability_progression
// _system.md §17). Angels → holy, demons → demonic, Seraphim → seraphic, the
// Light + its faces → light, the Void + its faces → void. Mythical/elemental
// beasts offer NO cosmic pact (a future basic-element pact). Curse is never
// pacted — it's forced by the Cursed Gem.
export const PACT_AFFINITY = {
    TheLight: "light", TheVoid: "void",
    TheZenith: "light", TheJustice: "light", TheMending: "light",
    TheHunger: "void", TheSilence: "void",
    Archangel: "holy", HolyAngel: "holy", Cherub: "holy",
    Seraphim: "seraphic",
    DemonLord: "demonic", Demon: "demonic", LesserDemon: "demonic",
}

// Void-aligned pacts exact an ONGOING TITHE; Light-aligned pacts are a PURE BOON
// (the boon/tithe split from the design). Drives pact dialog flavor now; the
// mechanical tithe is a later refinement.
export const PACT_IS_TITHE = new Set(["void", "demonic"])

// Beings a DUNGEON pact room may offer: demi-gods and lower (tier <= 5) that carry
// a pact affinity. EXCLUDES the Principles (Light/Void, tier 7) and the facsimiles
// (tier 6) — a player never forms a direct pact with those in a dungeon. Mythical
// beasts drop out automatically (no PACT_AFFINITY entry — basic affinities come
// from essences, not beast pacts).
export const DUNGEON_PACTABLE_KEYS = COSMIC_KEYS.filter(
    k => PACT_AFFINITY[k] && (COSMIC_PROFILES[k].tier ?? 99) <= 5
)

// Which BASIC affinity each MYTHICAL BEAST gifts — the empowered-basics vector. The
// beasts were deliberately left without a cosmic pact for exactly this: a friendly,
// worshipped planetary guardian bestows its element EMPOWERED (tier 1) as a BOON, not
// a bind (contrast PACT_AFFINITY). Fire/frost/lightning have no beast patron (they
// stay essence-only). See documents/v3_cosmic_hierarchy_and_entities.md §9.
export const BEAST_AFFINITY = {
    FirstWeaver:    "arcane",   // weaver of raw magic
    MountainsTooth: "earth",    // avalanche brute
    HollowSwarm:    "wind",     // swift airborne swarm
    OldCoil:        "poison",   // serpent venom
    GreyFamine:     "acid",     // withering corrosion
    TheUndying:     "physical", // grave-grasp raw force
}

// Beasts a GROVE room (or the bench) may offer — every mythical beast with a beast
// affinity. Parallel to DUNGEON_PACTABLE_KEYS.
export const BEAST_KEYS = COSMIC_KEYS.filter(k => BEAST_AFFINITY[k])
