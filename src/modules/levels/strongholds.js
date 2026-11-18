import Phaser from "phaser"

// A STRONGHOLD FLOOR — the whole floor is one inhabited place rather than a
// random assortment of monsters.
//
// This is the scaled-down descendant of two systems v5 cuts. v3's settlements
// (settlements/spawnSettlement.js, 625 lines) build themed camps with perimeters,
// gates and factions inside a floor; its encounters (encounters/index.js, 357)
// run a Battle/arena system with formations, objectives and pocket-dimension
// phasing. Between them that is roughly a thousand lines, and restoring the
// encounter half would mean undoing the isEngaged fix that made enemies pursue
// at all.
//
// What actually makes a settlement READ as a settlement is much cheaper than the
// machinery: everything living there belongs to the same group, there are more of
// them than usual, and someone is in charge. That is what this file is. The
// geometry stays ordinary BSP — no new level class — and only the POPULATION
// changes, which is where the character was all along.
//
// A floor carries `stronghold: <key>` in its LevelManager config; spawnFromTable
// reads it and populates from the theme instead of the floor-tier tables.

export const STRONGHOLDS = {
    goblinWarren: {
        label: "Goblin Warren",
        // Drawn from with repeats acting as weight — Goblins are the rank and
        // file, archers the support, the Orc an occasional heavy.
        species: ["Goblin", "Goblin", "GoblinArcher", "Goblin", "Orc"],
        leader: "Ogre",
        leaderTitle: "Warchief",
    },
    undeadCrypt: {
        label: "Undead Crypt",
        species: ["Skeleton", "Skeleton", "Ghost", "Bat"],
        leader: "DarkSorcerer",
        leaderTitle: "Necromancer",
    },
    beastNest: {
        label: "Beast Nest",
        species: ["Spider", "Spider", "Scorpion", "Slime"],
        leader: "Spider",
        leaderTitle: "Broodmother",
    },

    // --- CORRUPTED SETTLEMENTS (scope doc §10.13) ------------------------------
    //
    // A corrupted stronghold is the SAME roster wearing the void's face. `art`
    // maps a species name to a void reskin in the `cosmic` sheet, applied at spawn
    // by spawnFromTable — so these themes cost no enemy classes, no new AI and no
    // movement in the ~10 enemy cap. What makes them read as a different place is
    // the palette, the titles and the population, which is the same observation
    // the original three strongholds were built on.
    //
    // `tint` washes anything without its own reskin toward the void's violet, so
    // a corrupted floor is coherent even where the art runs out.
    corruptedHollow: {
        label: "Corrupted Hollow",
        species: ["Skeleton", "Ghost", "Skeleton", "DarkSorcerer", "Bat"],
        leader: "Ogre",
        leaderTitle: "Void Warlord",
        corrupted: true,
        tint: 0x9b6bd0,
        art: {
            Skeleton: { sheet: "cosmic", file: "void_undead/skeleton_void.png" },
            Ghost: { sheet: "cosmic", file: "void_undead/ghost.png" },
            DarkSorcerer: { sheet: "cosmic", file: "void_undead/dark_sorcerer.png" },
            Ogre: { sheet: "cosmic", file: "void_undead/void_warlord.png" },
        },
    },
    blightedCamp: {
        label: "Blighted Camp",
        // The goblin warren after the void got into it — the same rank and file,
        // wearing ghoul bodies, led by something that used to give orders.
        species: ["Goblin", "Goblin", "GoblinArcher", "Skeleton", "Goblin"],
        // Ogre, not Orc. The art map is keyed by CLASS NAME, so a leader whose
        // class also appears in `species` would hand its unique sprite to every
        // rank-and-file member of that class — the room would fill with Void
        // Captains. Keeping the leader's class out of the species list is what
        // makes `leaderArt` unnecessary.
        leader: "Ogre",
        leaderTitle: "Void Captain",
        corrupted: true,
        tint: 0x9b6bd0,
        art: {
            Goblin: { sheet: "cosmic", file: "void_undead/ghoul.png" },
            Skeleton: { sheet: "cosmic", file: "void_undead/skeleton_void.png" },
            Ogre: { sheet: "cosmic", file: "void_undead/void_captain.png" },
        },
    },
}

export const STRONGHOLD_KEYS = Object.keys(STRONGHOLDS)

// Pick a stronghold theme at random. Called once per run when the floor sequence
// is built, so a run's finale differs between playthroughs.
export function pickStronghold() {
    return Phaser.Utils.Array.GetRandom(STRONGHOLD_KEYS)
}

export function strongholdByKey(key) {
    return STRONGHOLDS[key] || null
}
