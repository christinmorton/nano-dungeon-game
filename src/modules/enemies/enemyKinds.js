// Centralized registry of enemy kinds. Used by BaseEnemy.onDestroy()
// to decide which drop table to roll, and by future content code that
// needs to branch on enemy ancestry (faction reactions, magic
// resistances, food drops, dialogue gating, etc.).
//
// Kinds are data, not a class hierarchy — adding/changing a kind is a
// one-line edit in this file instead of touching the enemy class or
// shuffling inheritance. See feedback memory "Kind field over hierarchy".
//
// Classified so far:
//   humanoid — bipedal, hands, intelligent. Currently the only kind
//              with a humanoid drop table (gems/potions/keys/items/
//              equipped weapon). Includes Skeleton (humanoid undead)
//              and Troll.
//   animal   — mammals, reptiles, crustaceans, anything "beast"-shaped.
//              Today: drop nothing beyond quest items.
//   insect   — true insects + arachnids. Today: drop nothing beyond
//              quest items.
//   spirit   — incorporeal undead (ghosts, shadows, ghasts). Today:
//              drop nothing beyond quest items. Drop table (ectoplasm,
//              soul shards, etc.) decided when the real loot system
//              is designed.
//
// Unclassified (default "creature"):
//   Slime — amorphous; no obvious peer kind yet. Promote when a
//           companion creature shows up or the loot system arrives.

const HUMANOID_NAMES = new Set([
    "Captain",
    "Cyclops",
    "DarkKnight",
    "DarkSorcerer",
    "DarkSorcererHigher",
    "EvilFriar",
    "EvilMonk",
    "EvilPriest",
    "Ghoul",
    "Goblin",
    "GoblinFiendish",
    "GoblinHigher",
    "HumanoidMarauder",
    "Imp",
    "Leprechaun",
    "MarauderBrute",
    "MarauderDualWield",
    "Mercenary",
    "MilitantOgre",
    "Ogre",
    "Orc",
    "OrcHigher",
    "Pirate",
    "ShamanMonster",
    "Skeleton",
    "Troll",
])

const ANIMAL_NAMES = new Set([
    "Bat",
    "CaveBear",
    "Crab",
    "DungeonBoar",
    "DungeonLizard",
    "DungeonLynx",
    "DungeonWolf",
    "Snake",
])

const INSECT_NAMES = new Set([
    "Beetle",
    "FlyWasp",
    "Scarab",
    "ScarabHigher",
    "Scorpion",
    "Spider",
])

const SPIRIT_NAMES = new Set([
    "Ghast",
    "GhastHigher",
    "Ghost",
    "Shadow",
    "ShadowHigher",
])

// Parallel axis to kind — "is this enemy undead?" Crosses biology
// classes: all spirits are undead, plus specific humanoid undead
// (Skeleton, Ghoul). Used by Cleric Smite (2× damage) and Turn Undead
// (only undead are affected). Add new undead enemies here as they ship.
const UNDEAD_NAMES = new Set([
    "Ghast",
    "GhastHigher",
    "Ghost",
    "Ghoul",
    "Shadow",
    "ShadowHigher",
    "Skeleton",
])

// Parallel axis — "does this enemy have natural armor that can deflect
// a weapon swing?" Carapaces, shells, chitin. Crosses biology classes
// (mostly insects but also crustacean animals like Crab). Used by
// BaseEnemy.blockChance to allow block rolls for shelled animals/
// insects that the default "animals/insects can't block" rule excludes.
const SHELLED_NAMES = new Set([
    "Beetle",
    "Crab",
    "Scarab",
    "ScarabHigher",
    "Scorpion",
])

// Return the canonical kind string for an enemy instance. Falls back
// to "creature" so unclassified enemies don't crash callers and so
// future filters (`kindOf(e) === "humanoid"`) read cleanly.
export function kindOf(enemy) {
    const name = enemy?.constructor?.name
    if (HUMANOID_NAMES.has(name)) return "humanoid"
    if (ANIMAL_NAMES.has(name)) return "animal"
    if (INSECT_NAMES.has(name)) return "insect"
    if (SPIRIT_NAMES.has(name)) return "spirit"
    return "creature"
}

// Parallel-axis predicate. Returns true if the enemy is undead per
// UNDEAD_NAMES above. Kept as a function (not a flag on the enemy) so
// the classification stays data in one file rather than per-class
// state to forget to set.
export function isUndead(enemy) {
    const name = enemy?.constructor?.name
    return UNDEAD_NAMES.has(name)
}

// Parallel-axis predicate. Returns true if the enemy has natural armor
// (carapace / chitin / shell). Used by BaseEnemy.blockChance to override
// the default "animals/insects can't block" rule for shelled species.
export function isShelled(enemy) {
    const name = enemy?.constructor?.name
    return SHELLED_NAMES.has(name)
}

// Exported for tooling / debug screens that want to enumerate every
// classified enemy by kind. Not used by combat code.
export const ENEMY_KIND_SETS = {
    humanoid: HUMANOID_NAMES,
    animal: ANIMAL_NAMES,
    insect: INSECT_NAMES,
    spirit: SPIRIT_NAMES,
    undead: UNDEAD_NAMES,
    shelled: SHELLED_NAMES,
}
