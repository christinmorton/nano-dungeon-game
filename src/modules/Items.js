import HealthPotion from "./items/HealthPotion.js"
import GreaterHealthPotion from "./items/GreaterHealthPotion.js"
import StaminaPotion from "./items/StaminaPotion.js"
import Potion from "./items/Potion.js"
import Gem from "./items/Gem.js"
import DungeonKey from "./items/DungeonKey.js"
import { makeItem, ITEM_PROFILES } from "./items/itemProfiles.js"

// Registry of BEHAVIOUR-VARIED items — the ones that are real classes because
// they do something on use — plus capitalized aliases for the profile-based
// weapons and armor, so drop tables can write `new items.Sword()` without
// knowing whether a given item is a class or a profile.
//
// v3's version registers nine classes and ~45 aliases. v5's registers six and
// fifteen, because that is what the nineteen profiles in itemProfiles.js and the
// five carried consumables add up to.
//
// A profile entry is a FACTORY FUNCTION, not a class. `new items.Sword()` works
// because a constructor that returns an object yields that object — which is also
// why `instanceof` can never recover a profile item's name, and why makeItem
// stamps `profileKey` onto the instance instead.
function profileFactory(key) {
    return function (x, y) {
        return makeItem(key, x, y)
    }
}

const items = {
    // Real classes — each overrides equip() to do something.
    HealthPotion,
    GreaterHealthPotion,
    StaminaPotion,
    Potion,
    Gem,
    DungeonKey,

    // Profile aliases (capitalized), resolved through makeItem.
    Sword: profileFactory("sword"),
    Dagger: profileFactory("dagger"),
    Axe: profileFactory("axe"),
    Mace: profileFactory("mace"),
    LongSword: profileFactory("longSword"),
    Greatsword: profileFactory("greatsword"),
    Spear: profileFactory("spear"),
    Quarterstaff: profileFactory("quarterstaff"),
    Bow: profileFactory("bow"),
    Crossbow: profileFactory("crossbow"),
    Wand: profileFactory("wand"),
    Shield: profileFactory("shield"),
    Buckler: profileFactory("buckler"),
    Helmet: profileFactory("helmet"),
    Torch: profileFactory("torch"),
}

export default items
export { makeItem, ITEM_PROFILES }

// v3 rolled material tags (Golden / Silver / Iron) and effect tags onto a dropped
// item here, so a dropped Gem or Potion picked up a rarity flavour. v5 items are
// FLAT — no tier, no rarity, no material tags (scope doc section 5) — so there is
// nothing to apply and this is a pass-through.
//
// Kept as a function rather than deleted at every call site: the drop tables in
// BaseEnemy read much better as `applyDefaultRandomTags(new items.Gem())` than as
// a bare construction, and if item tags ever return under section 9 this is the
// one place they reattach.
export function applyDefaultRandomTags(instance) {
    return instance
}

// A random item instance, used by loot paths that just want "something".
export function getRandomItem(x, y) {
    const key = Object.keys(items)[Math.floor(Math.random() * Object.keys(items).length)]
    return applyDefaultRandomTags(new items[key](x, y))
}
