import Taggable from "../Taggable.js";
import dungeon from "../Dungeon.js"
import { rankByIndex } from "../Rank.js"

// Slot names match the equippedSlots map on HeroInventory.
// `null` slot = unequippable (consumables, quest items, scrolls of utility).
export const SLOT_NAMES = ['mainhand', 'offhand', 'head', 'body', 'feet', 'gloves', 'accessory']

// Quality each material tag contributes to an item's rank score. Golden is the
// rare/best material, iron the baseline (see Tags.js `materials`). `cursed`
// drags the rank down; any other tag (future enchantments/affixes) nudges it up.
const MATERIAL_SCORE = { golden: 4, silver: 2, iron: 0 }

export default class GenericItem extends Taggable {
    constructor(x, y, tile, tint, art) {
        super()

        this.active = false;
        this.type = 'item';
        this.weapon = false;
        this.name = "Nameless Item"
        this.description = "it is nothing special"
        this.tile = tile
        if (tint) this.tint = tint
        // Optional PNG art ({ sheet, file|frame }) for the render path; falls
        // back to the Kenney `tile` when null. See modules/assetLoader.js.
        this.art = art ?? null
        this.tagPolicy = { materials: true, effects: true }

        // Virtual items participate in stat math via statContribution()
        // but skip drop logic — used for enemy built-in equipment (claws,
        // bone hide, etc.) that should never pour into a loot bag.
        this.virtual = false

        // Subclasses override:
        //   slot         -> one of SLOT_NAMES, or null for unequippable
        //   damageType   -> 'physical' (default) / 'magic' / 'true' for weapons
        this.slot = null
        this.damageType = 'physical'

        if (x != null && y != null) {
            this.x = x
            this.y = y
        }

        dungeon.initializeEntity(this)
    }

    damage() {
        return 0;
    }

    protection() {
        return 0;
    }

    range() {
        return 0;
    }

    minRange() {
        return 0;
    }

    // Per-stat contribution from this item when equipped. Combat reads
    // this via inventory.statContribution(name), summed across slots.
    //
    // Weapon damage is NOT routed here — it's rolled per-attack by
    // BaseHero.attack() via weapon.damage(). statContribution is for
    // passive stat sources (armor from a shield, +DEX from a ring, etc).
    // Subclasses with passives override to return values for specific
    // stat names; everything else returns 0.
    statContribution(name) {
        if (name === 'armor') return this.protection()
        return 0
    }

    turn() {}

    // The item's F→S rank (modules/Rank.js), computed from its quality tags.
    // The first consumer of the universal Rank scale: a plain item sits low,
    // better materials raise it, enchantments nudge it up, a curse drags it
    // down. Computed on demand so it reflects tags added after construction
    // (applyDefaultRandomTags runs post-constructor).
    rankKey() {
        let score = 1 // a plain real item sits near the bottom of the scale
        for (const t of (this._tags || [])) {
            if (MATERIAL_SCORE[t] != null) score += MATERIAL_SCORE[t]
            else if (t === 'cursed') score -= 3
            else score += 1 // any other tag = an enchantment/affix → a touch better
        }
        return rankByIndex(score).key
    }

    damagedEntity(entity) { return entity }

    equip() {}

    unequip() {}

    refresh() {}

    over() {return true;}

    createUI() {return 0;}
}
