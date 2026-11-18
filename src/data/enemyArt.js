// Enemy class name -> art declaration ({ sheet, file }) for the in-game
// render path (Dungeon.initializeEntity reads entity.art). Keyed by
// constructor.name to match enemyKinds.js (kindOf / isUndead / isShelled).
// BaseEnemy sets this.art from this map at construction; a subclass or
// recipe can override this.art afterward (e.g. species captains, gendered
// or void-corrupted variants). Files live in public/art/monsters/ — see
// tileReference.monsters.json. Variants that share a base sprite (Fiendish
// goblin, Greater Shadow) point at the base intentionally.
export const monster = (file) => ({ sheet: "monsters", file })
const M = monster
// Cosmic pack (art/cosmic, tileReference.cosmic.json). Cosmic BEINGS now declare
// their art in data/cosmicBeings.js (via this helper); this map keeps only the
// legacy monster-sheet entries.
export const cosmic = (file) => ({ sheet: "cosmic", file })

export default {
    // --- Humanoids ---
    Orc: M("orc_south.png"),
    OrcHigher: M("elite_orc_south.png"),
    Goblin: M("goblin_south.png"),
    // Added 2026-09-22. GoblinArcher is a v5 addition (scope doc §10.4) and was never
    // registered here, so BaseEnemy set this.art = null and the render path fell back to
    // the Kenney tile — it was drawing as a 1-bit ghost while its own sprite sat unused
    // on disk. Third omission of the same shape on this class in one day (the other two:
    // enemyKinds.HUMANOID_NAMES, and its drop table). A new enemy class needs an entry in
    // EVERY class-name-keyed map, not just this one.
    GoblinArcher: M("goblin_archer_south.png"),
    GoblinHigher: M("elite_goblin_south.png"),
    GoblinFiendish: M("goblin_south.png"),
    Troll: M("troll_south.png"),
    Ogre: M("ogre_south.png"),
    MilitantOgre: M("militant_ogre_south.png"),
    Cyclops: M("cyclops_south.png"),
    ShamanMonster: M("orc_shaman_south.png"),
    Imp: M("imp_south.png"),
    Leprechaun: M("trickster_south.png"),
    HumanoidMarauder: M("marauder_south.png"),
    MarauderBrute: M("reaver_south.png"),
    MarauderDualWield: M("outlaw_south.png"),
    Mercenary: M("outlaw_south.png"),
    Pirate: M("corsair_south.png"),
    Captain: M("orc_captain_south.png"),
    DarkKnight: M("dark_knight_south.png"),
    DarkSorcerer: M("dark_sorcerer_south.png"),
    DarkSorcererHigher: M("elder_dark_sorcerer_south.png"),
    EvilFriar: M("dark_friar_south.png"),
    EvilMonk: M("dark_monk_south.png"),
    EvilPriest: M("dark_priest_south.png"),
    Skeleton: M("skeleton_south.png"),
    Ghoul: M("ghoul_south.png"),

    // --- Animals ---
    Bat: M("bat_south.png"),
    CaveBear: M("bear_south.png"),
    DungeonBoar: M("boar_south.png"),
    DungeonLizard: M("lizard_south.png"),
    DungeonLynx: M("lynx_south.png"),
    DungeonWolf: M("wolf_south.png"),
    Snake: M("snake_south.png"),
    Crab: M("crab_south.png"),

    // --- Insects ---
    Beetle: M("beetle_south.png"),
    FlyWasp: M("wasp_south.png"),
    Scarab: M("scarab_south.png"),
    ScarabHigher: M("giant_scarab_south.png"),
    Scorpion: M("scorpion_south.png"),
    Spider: M("spider_south.png"),

    // --- Spirits / undead ---
    Ghost: M("ghost_south.png"),
    Shadow: M("shadow_south.png"),
    ShadowHigher: M("shadow_south.png"),
    Ghast: M("ghast_south.png"),
    GhastHigher: M("greater_ghast_south.png"),

    // --- Creature ---
    Slime: M("slime_south.png"),

    // NOTE: cosmic beings (angels, demons, facsimiles, Principles, mythical
    // demi-gods) are data-driven — their art lives in data/cosmicBeings.js and is
    // applied by modules/enemies/CosmicBeing.js, not mapped here.
}
