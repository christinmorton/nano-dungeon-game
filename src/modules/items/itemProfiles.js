import MeleeWeapon from "./MeleeWeapon.js"
import RangedWeapon from "./RangedWeapon.js"
import Armor from "./Armor.js"
import LightSource from "./LightSource.js"

import sword from "./profiles/sword.js"
import dagger from "./profiles/dagger.js"
import axe from "./profiles/axe.js"
import mace from "./profiles/mace.js"
import longSword from "./profiles/longSword.js"
import greatsword from "./profiles/greatsword.js"
import spear from "./profiles/spear.js"
import quarterstaff from "./profiles/quarterstaff.js"

import bow from "./profiles/bow.js"
import crossbow from "./profiles/crossbow.js"
import shortBow from "./profiles/shortBow.js"
import wardenLongbow from "./profiles/wardenLongbow.js"
import serpentBow from "./profiles/serpentBow.js"
import siegeCrossbow from "./profiles/siegeCrossbow.js"
import scrollOfFireball from "./profiles/scrollOfFireball.js"
import scrollOfLightning from "./profiles/scrollOfLightning.js"
import wand from "./profiles/wand.js"
import rimeRod from "./profiles/rimeRod.js"
import emberStaff from "./profiles/emberStaff.js"
import arcanistsStaff from "./profiles/arcanistsStaff.js"
import stormcallerStaff from "./profiles/stormcallerStaff.js"
import tomeOfImmolation from "./profiles/tomeOfImmolation.js"
import tomeOfDeepFrost from "./profiles/tomeOfDeepFrost.js"
import darkBolt from "./profiles/darkBolt.js"

import helmet from "./profiles/helmet.js"
import shield from "./profiles/shield.js"
import buckler from "./profiles/buckler.js"
import realmCuirass from "./profiles/realmCuirass.js"
import huntersLeathers from "./profiles/huntersLeathers.js"
import acolyteRobe from "./profiles/acolyteRobe.js"

import torch from "./profiles/torch.js"
import LEGENDARIES from "./profiles/legendaries.js"

// Registry of profile-based items — weapons, armor, light. Adding one is two
// lines here plus a data file under profiles/, with no new class needed.
// Behavior-varied items (potions, gems) stay as subclasses and live in Items.js.
//
// v5 carried nineteen against v3's ~122. v3's file imports about forty-five
// individual profiles plus thirteen spread bundles (throwables, runes, reagents,
// tomes, affinity essences, boosters, legendaries...), most of which belong to
// systems cut in scope doc section 6 or to categories whose mechanics were never
// built. Written small rather than pruned, same as the other registries.
//
// The nineteen were derived, not guessed: the three class profiles need sword,
// bow and scrollOfFireball to start, and the rest is a loot table with enough
// spread that two runs differ — eight melee, four ranged, six armor, one light.
//
// THIRTY as of 2026-10-04 (scope doc §10.16): the Warrior had eight blades to
// climb and the Ranger and Wizard had two rungs each, so eleven ranged and
// caster weapons were added — four bows, seven staves/scrolls/tomes — tiered by
// `minFloor` (see lootKeysForFloor) so the deep ones arrive deep. The caster
// ones carry `empower`, which is what makes a scroll matter to a Wizard; see
// abilities/empower.js.
const ITEM_PROFILES = {
    sword,
    dagger,
    axe,
    mace,
    longSword,
    greatsword,
    spear,
    quarterstaff,

    bow,
    crossbow,
    shortBow,
    wardenLongbow,
    serpentBow,
    siegeCrossbow,
    scrollOfFireball,
    scrollOfLightning,
    wand,
    rimeRod,
    emberStaff,
    arcanistsStaff,
    stormcallerStaff,
    tomeOfImmolation,
    tomeOfDeepFrost,
    // ENEMY-ONLY. The Dark Sorcerer's conduit (scope doc §10.12). It is in this
    // registry so makeItem('darkBolt') resolves, but it is excluded from
    // LOOT_KEYS below, so it never drops, never fills a chest, and never appears
    // as the shop's wildcard. Adding an enemy weapon here without that exclusion
    // is how a caster weapon no class can use ends up in the player's pack.
    darkBolt,

    helmet,
    shield,
    buckler,
    realmCuirass,
    huntersLeathers,
    acolyteRobe,

    torch,

    // The fourteen legendaries (scope doc §10.12). Spread in rather than listed
    // one by one: they are an authored SET, and the set's own file is where an
    // addition or a stat change belongs. Every one declares droppable: false, so
    // LOOT_KEYS excludes them and they reach the player only through the
    // rare-chest roll in levels/spawnFromTable.js.
    ...LEGENDARIES,
}

// Every profile above declares one of these four. v3's map carries ten more
// entries routing cut categories through a generic Consumable placeholder;
// none of those categories exist here.
const CLASS_MAP = {
    MeleeWeapon,
    RangedWeapon,
    Armor,
    LightSource,
}

// Factory: construct a profiled item by name. Throws on an unknown name so typos
// surface immediately rather than producing a broken sprite.
//
// Not carried from v3: the itemArchive.json name/lore overlay. That archive is
// authored in the Dungeon Designer, which v5 cuts, and only its name and lore
// ever reached the game. Items use their coded profile text. Re-adding the
// overlay is one import and five lines, and would be a section 9 decision.
export function makeItem(profileName, x, y) {
    const profile = ITEM_PROFILES[profileName]
    if (!profile) {
        throw new Error(`Unknown item profile: ${profileName}`)
    }
    const Class = CLASS_MAP[profile.itemClass]
    if (!Class) {
        throw new Error(`Unknown itemClass on profile '${profileName}': ${profile.itemClass}`)
    }
    const inst = new Class(x, y, profile)
    // Stamp the profile key so serialization can round-trip the item. A profile's
    // registry entry is a FACTORY call, not a class, so `instanceof` can't recover
    // its name — ItemSerializer reads this instead.
    inst.profileKey = profileName
    return inst
}

// Profile keys that may be given to the PLAYER by a random source — loot tables,
// chest contents, the shop's wildcard slot.
//
// Not every registered profile is loot. An enemy's own weapon lives in the
// registry so makeItem() can build it, but handing it to the player through a
// random roll gives them gear no class is built to use. Anything declaring
// `droppable: false` opts out here; BaseEnemy's mainhand-drop branch honours the
// same field, so one flag on the profile covers both routes.
//
// Callers use this INSTEAD of Object.keys(ITEM_PROFILES). Reaching for the raw
// keys is the bug: it works, it reads fine, and it quietly re-admits every
// enemy-only item the next time one is added.
export const LOOT_KEYS = Object.keys(ITEM_PROFILES)
    .filter(k => ITEM_PROFILES[k].droppable !== false)

// LOOT_KEYS narrowed to what may appear on floor index `floor` (§10.16). A
// profile's `minFloor` is the first floor index it can drop on or be sold on;
// absent means anywhere. This is how the Siege Crossbow and the tomes stay out
// of a floor-1 chest without a tier system — one number on the profile.
export function lootKeysForFloor(floor) {
    const f = floor ?? 0
    return LOOT_KEYS.filter(k => (ITEM_PROFILES[k].minFloor ?? 0) <= f)
}

export { ITEM_PROFILES }
