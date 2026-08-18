import Phaser from "phaser"

import CursedGem from "./items/CursedGem.js"
import DungeonKey from "./items/DungeonKey.js"
import Gem from "./items/Gem.js"
import GreaterHealthPotion from "./items/GreaterHealthPotion.js"
import HealthPotion from "./items/HealthPotion.js"
import Potion from "./items/Potion.js"
import ScrollOfBlink from "./items/ScrollOfBlink.js"
import ScrollOfTeleport from "./items/ScrollOfTeleport.js"
import StaminaPotion from "./items/StaminaPotion.js"
import { makeItem, ITEM_PROFILES } from "./items/itemProfiles.js"
import { getRandomTagsForItem } from "./Tags.js"

// Item registry. Two flavors of entry coexist here:
//
//   1. Behavior-varied items (potions, utility scrolls, currency,
//      quest items) remain as real classes — their per-item logic
//      lives in equip()/value()/etc. and resists data-only modeling.
//
//   2. Data-varied items (weapons, armor) are profile-based via
//      makeItem(). The dict entry for e.g. items.Sword is a function
//      that returns a fresh MeleeWeapon configured from the sword
//      profile, so `new items.Sword()` still works (JS treats `new`
//      on a function that returns an object as "use that object",
//      ignoring `this`).
//
// getRandomItem picks uniformly across both flavors; nothing in the
// game code needs to know which path produced an item.

// Capitalized aliases so the existing items.Sword / items.Axe call
// sites keep working. Profile name -> aliased factory entry.
const PROFILE_ALIASES = {
    Sword: 'sword',
    Axe: 'axe',
    Hammer: 'hammer',
    LongSword: 'longSword',
    Spear: 'spear',
    Bow: 'bow',
    ScrollOfFireball: 'scrollOfFireball',
    ScrollOfLightning: 'scrollOfLightning',
    Shield: 'shield',
    Helmet: 'helmet',
    Dagger: 'dagger',
    Mace: 'mace',
    Quarterstaff: 'quarterstaff',
    Greatsword: 'greatsword',
    Crossbow: 'crossbow',
    Wand: 'wand',
    Buckler: 'buckler',
    TowerShield: 'towerShield',
    Tome: 'tome',
    Orb: 'orb',
    HuntersCap: 'huntersCap',
    AcolyteHood: 'acolyteHood',
    WardenGreatHelm: 'wardenGreatHelm',
    RealmCuirass: 'realmCuirass',
    RealmHauberk: 'realmHauberk',
    HuntersLeathers: 'huntersLeathers',
    AcolyteRobe: 'acolyteRobe',
    WardenSabatons: 'wardenSabatons',
    HuntersBoots: 'huntersBoots',
    WandererShoes: 'wandererShoes',
    WardenGauntlets: 'wardenGauntlets',
    HuntersGloves: 'huntersGloves',
    AcolyteWraps: 'acolyteWraps',
    RingOfMight: 'ringOfMight',
    RingOfTheCat: 'ringOfTheCat',
    RingOfFocus: 'ringOfFocus',
    RingOfVigor: 'ringOfVigor',
    WardingPendant: 'wardingPendant',
    Torch: 'torch',
    Lantern: 'lantern',
    LightsBeacon: 'lightsBeacon',
}

const items = {
    CursedGem,
    DungeonKey,
    Gem,
    GreaterHealthPotion,
    HealthPotion,
    Potion,
    ScrollOfBlink,
    ScrollOfTeleport,
    StaminaPotion,
}
for (const [alias, profileName] of Object.entries(PROFILE_ALIASES)) {
    items[alias] = function (x, y) {
        return makeItem(profileName, x, y)
    }
}

// Reverse map: lowercase profileName -> capitalized registry alias. makeItem
// stamps the lowercase profileName as `profileKey`, but aliased weapons/armor
// are registered ONLY under the capitalized alias (the auto-register loop below
// deliberately skips the lowercase name to avoid double-weighting the drop pool).
// Serialization resolves through this so a dropped Sword is recoverable by its
// registry key — without it, gear in a container serializes to null and vanishes
// from FloorMemory snapshots on floor revisit.
const PROFILE_TO_ALIAS = {}
for (const [alias, profileName] of Object.entries(PROFILE_ALIASES)) {
    PROFILE_TO_ALIAS[profileName] = alias
}

// Auto-register every other DROPPABLE profile (e.g. reagents) into the drop
// pool so catalog items appear without a per-item alias. System-pending items
// set `droppable: false` and are skipped — still constructible via makeItem and
// browsable, just kept out of random drops until their system ships (#47).
const aliasedProfiles = new Set(Object.values(PROFILE_ALIASES))
for (const [name, profile] of Object.entries(ITEM_PROFILES)) {
    if (profile.droppable === false) continue
    if (aliasedProfiles.has(name) || items[name]) continue
    // Regular function (not arrow): getRandomItem does `new items[key]()`,
    // and arrow functions have no [[Construct]]. Returning an object from a
    // normal function makes `new` yield that object.
    items[name] = function (x, y) { return makeItem(name, x, y) }
}

// Never let an ultimate-teaching tome sit in the drop pool — ultimates are
// role-unique and unlearnable (see BaseHero.learnAbility). The tier check needs
// the ability registry, but a STATIC import here would be fatal: Items.js is
// imported by BaseEnemy during BaseEnemy's own init, and the registry eagerly
// globs every ability (incl. Follower, which extends BaseEnemy) → re-entrant TDZ
// crash. A dynamic import resolves on a microtask AFTER the sync graph settles, so
// BaseEnemy is fully built by then. None exist today; this future-proofs the rule.
import("./classes/abilities/abilityRegistry.js").then(({ abilityByName }) => {
    for (const key of Object.keys(items)) {
        const profile = ITEM_PROFILES[key]
        if (profile?.itemClass === 'Tome' && abilityByName(profile.teaches)?.tier === 'ultimate') {
            delete items[key]
        }
    }
}).catch(() => {})

// Resolve a makeItem `profileKey` to the registry key its factory is stored
// under. Non-aliased profiles (reagents, etc.) register under their own name;
// aliased weapons/armor register under the capitalized alias. Returns null for
// an unknown profile. Used by ItemSerializer to round-trip container contents.
export function registryKeyForProfile(profileKey) {
    if (!profileKey) return null
    if (items[profileKey]) return profileKey
    const alias = PROFILE_TO_ALIAS[profileKey]
    return alias && items[alias] ? alias : null
}

export default items
export { makeItem, ITEM_PROFILES }


export function getRandomItem(x, y, modifierCount = 1, effectCount = 1) {
    const key = Phaser.Utils.Array.GetRandom(Object.keys(items))
    const instance = new items[key](x, y)
    return applyDefaultRandomTags(instance, modifierCount, effectCount)
}

// Apply the standard random-tag pass (materials + effects) to an item
// instance, respecting the item's tagPolicy. Shared by getRandomItem
// (uniform-random spawns) and BaseEnemy.onDestroy (weighted humanoid
// drops) so a dropped Gem still rolls Iron/Silver/Golden and a dropped
// Potion still picks up modifier tags.
export function applyDefaultRandomTags(instance, modifierCount = 1, effectCount = 1) {
    const policy = instance.tagPolicy || { materials: true, effects: true }
    const mods = policy.materials ? modifierCount : 0
    const effs = policy.effects ? effectCount : 0
    const tags = getRandomTagsForItem(mods, effs)
    return instance.addTags(tags)
}
