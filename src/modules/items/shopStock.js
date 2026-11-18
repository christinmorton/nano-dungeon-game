import Phaser from "phaser"
import items from "../Items.js"
import mapState from "../MapState.js"
import { makeItem, ITEM_PROFILES, lootKeysForFloor } from "./itemProfiles.js"

// Shop stock — COMPOSED, not rolled (scope doc §10.11).
//
// v3's rollStock was a flat uniform pick over the whole item registry, filtered
// only for currency and cursed items. Two consequences the user asked to fix:
// a run could pass every shop without ever being offered healing, and a Wizard
// was routinely shown swords and heavy armour it could not use.
//
// The composition instead guarantees the floor:
//   slot 1   Health Potion   — always
//   slot 2   Cure Potion     — always
//   slots 3+ gear the CURRENT CLASS can actually use
//   last     one wildcard, so shops still surprise
//
// No schema change was needed for the class filter: item profiles already
// declare `itemClass` and `weaponCategory`, and class profiles already declare
// `name`. This file is the only place that knows which is which, so retuning a
// class's shop is an edit here and nowhere else.

const STOCK_SIZE = 6

// What each class is offered. `categories` matches a weapon profile's
// `weaponCategory`; `armor` lists armour profiles by key. Keys are profile names
// from itemProfiles.js, so a typo surfaces immediately via makeItem's throw.
//
// Deliberately overlapping rather than exclusive: a Ranger may be sold a dagger
// and a Warrior a spear, because a shop that only ever offers the one obvious
// weapon for your class stops being a decision. What it will NOT do is offer a
// Wizard a greatsword.
const CLASS_STOCK = {
    Warrior: {
        weapons: ['sword', 'longSword', 'greatsword', 'axe', 'mace', 'spear'],
        armor: ['helmet', 'shield', 'realmCuirass'],
    },
    Ranger: {
        weapons: ['bow', 'crossbow', 'shortBow', 'wardenLongbow', 'serpentBow', 'siegeCrossbow', 'dagger', 'spear'],
        armor: ['huntersLeathers', 'buckler', 'helmet'],
    },
    Wizard: {
        weapons: [
            'wand', 'scrollOfFireball', 'scrollOfLightning', 'rimeRod', 'emberStaff',
            'arcanistsStaff', 'stormcallerStaff', 'tomeOfImmolation', 'tomeOfDeepFrost', 'dagger',
        ],
        armor: ['acolyteRobe', 'buckler'],
    },
}

// Floor gate (§10.16): a weapon whose `minFloor` is below the current floor
// stays off the shelf, so the shop's ladder climbs with the descent the way
// the chests' does. Read at roll time — this module sits in a cycle through
// Shopkeeper → Dungeon, so nothing here touches mapState at module scope.
function onThisFloor(key) {
    const floor = mapState.levelManager?.currentLevel ?? 0
    return (ITEM_PROFILES[key]?.minFloor ?? 0) <= floor
}

// Anything a shop may offer as its wildcard. Excludes nothing by class — that is
// the point of the slot — but a wildcard is still a real, usable profile rather
// than a currency pickup, so there is no "buy coins with coins" nonsense.
//
// LOOT_KEYS, not every registered profile — an enemy-only weapon (the Dark
// Sorcerer's Dark Bolt) is in the registry so makeItem can build it, and must
// never turn up on a shop shelf.
//
// Read LAZILY, not as a module-scope const. Touching an imported binding while
// this module's own body runs is the exact shape of the TDZ crash abilityRegistry
// hit when the Intro screen re-ordered module evaluation (see its warning
// comment). This file is reached from Shopkeeper -> Dungeon, so it sits in a
// cycle; computing at call time keeps the module body free of imported reads.
// Floor-gated like the class picks (§10.16).
function wildcardKeys() {
    return lootKeysForFloor(mapState.levelManager?.currentLevel ?? 0)
}

// The class the stock is built for. Falls back to Wizard the same way
// Dungeon.placePlayer does, so a shop can never end up with an empty table if
// the hero key is missing or misspelled.
function stockFor(heroKey) {
    return CLASS_STOCK[heroKey] || CLASS_STOCK.Wizard
}

// Build the shop's stock for `heroKey` (the registry key set by the Intro class
// picker, e.g. "Warrior"). Items are constructed with NO x/y, so they have no
// world sprite and live purely inside the shopkeeper until bought — the same
// trick chest contents use.
export function rollStock(heroKey) {
    const table = stockFor(heroKey)
    const stock = []

    // The two guarantees. A player who has found no healing must always be able
    // to buy some, which is the whole reason this function is composed.
    stock.push(new items.HealthPotion())
    stock.push(new items.Potion())          // "Cure Potion" — see items/Potion.js

    // Class gear: weapons first so every shop has at least one, then armour.
    // Sampled without replacement so one shop never lists the same sword twice.
    const picks = [
        ...sample(table.weapons.filter(onThisFloor), 2),
        ...sample(table.armor, 1),
    ]
    for (const key of picks) stock.push(makeItem(key))

    // One wildcard to keep shops from reading as a fixed menu. It may duplicate a
    // class pick; that is acceptable and much cheaper than threading exclusions.
    while (stock.length < STOCK_SIZE) {
        stock.push(makeItem(Phaser.Utils.Array.GetRandom(wildcardKeys())))
    }

    return stock
}

// Pick up to `n` distinct entries from `pool` without mutating the caller's array.
function sample(pool, n) {
    const copy = [...(pool || [])]
    Phaser.Utils.Array.Shuffle(copy)
    return copy.slice(0, n)
}

// Prices. Duck-typed on the fields items already carry rather than a price table,
// so adding an item profile never means remembering to price it.
//
// `value()` exists on tally items (gems) and is respected where present; gear
// falls back by broad category. Sell is a flat fraction of buy — no haggling, no
// reputation, no condition (§10.11 keeps this a room, not a system).
const BUY_WEAPON = 14
const BUY_WEARABLE = 10
const BUY_CONSUMABLE = 6
const SELL_RATE = 0.5

export function buyPrice(item) {
    if (typeof item.value === "function") {
        const v = item.value()
        if (typeof v === "number" && v > 0) return v
    }
    if (item.weapon) return BUY_WEAPON
    if (item.slot) return BUY_WEARABLE
    return BUY_CONSUMABLE
}

export function sellPrice(item) {
    return Math.max(1, Math.floor(buyPrice(item) * SELL_RATE))
}
