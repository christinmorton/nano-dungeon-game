import itemArchive from "../../data/itemArchive.json"
import MeleeWeapon from "./MeleeWeapon.js"
import RangedWeapon from "./RangedWeapon.js"
import Armor from "./Armor.js"
import LightSource from "./LightSource.js"
import Consumable from "./Consumable.js"
import ThrowableItem from "./ThrowableItem.js"
import DraughtItem from "./DraughtItem.js"

import sword from "./profiles/sword.js"
import axe from "./profiles/axe.js"
import hammer from "./profiles/hammer.js"
import longSword from "./profiles/longSword.js"
import spear from "./profiles/spear.js"
import bow from "./profiles/bow.js"
import scrollOfFireball from "./profiles/scrollOfFireball.js"
import scrollOfLightning from "./profiles/scrollOfLightning.js"
import spiritBolt from "./profiles/spiritBolt.js"
import shield from "./profiles/shield.js"
import helmet from "./profiles/helmet.js"
import dagger from "./profiles/dagger.js"
import mace from "./profiles/mace.js"
import quarterstaff from "./profiles/quarterstaff.js"
import greatsword from "./profiles/greatsword.js"
import crossbow from "./profiles/crossbow.js"
import wand from "./profiles/wand.js"
import buckler from "./profiles/buckler.js"
import towerShield from "./profiles/towerShield.js"
import tome from "./profiles/tome.js"
import orb from "./profiles/orb.js"
import huntersCap from "./profiles/huntersCap.js"
import acolyteHood from "./profiles/acolyteHood.js"
import wardenGreatHelm from "./profiles/wardenGreatHelm.js"
import realmCuirass from "./profiles/realmCuirass.js"
import realmHauberk from "./profiles/realmHauberk.js"
import huntersLeathers from "./profiles/huntersLeathers.js"
import acolyteRobe from "./profiles/acolyteRobe.js"
import wardenSabatons from "./profiles/wardenSabatons.js"
import huntersBoots from "./profiles/huntersBoots.js"
import wandererShoes from "./profiles/wandererShoes.js"
import wardenGauntlets from "./profiles/wardenGauntlets.js"
import huntersGloves from "./profiles/huntersGloves.js"
import acolyteWraps from "./profiles/acolyteWraps.js"
import ringOfMight from "./profiles/ringOfMight.js"
import ringOfTheCat from "./profiles/ringOfTheCat.js"
import ringOfFocus from "./profiles/ringOfFocus.js"
import ringOfVigor from "./profiles/ringOfVigor.js"
import wardingPendant from "./profiles/wardingPendant.js"
import torch from "./profiles/torch.js"
import lantern from "./profiles/lantern.js"
import lightsBeacon from "./profiles/lightsBeacon.js"
import lightboundReliquary from "./profiles/lightboundReliquary.js"
import guildCharter from "./profiles/guildCharter.js"
import emberOfReturn from "./profiles/emberOfReturn.js"

// Bulk catalog categories (data objects keyed by profile name). Systems for
// most of these are pending — see known-issues #47. Spread into ITEM_PROFILES.
import throwables from "./profiles/throwables.js"
import throwingWeapons from "./profiles/throwingWeapons.js"
import utilityFlasks from "./profiles/utilityFlasks.js"
import deployables from "./profiles/deployables.js"
import runes from "./profiles/runes.js"
import reagents from "./profiles/reagents.js"
import tomes from "./profiles/tomes.js"
import affinityEssences from "./profiles/affinityEssences.js"
import boosters from "./profiles/boosters.js"
import utilityScrolls from "./profiles/utilityScrolls.js"
import utilityItems from "./profiles/utilityItems.js"
import legendaries from "./profiles/legendaries.js"

// Registry of profile-based items (weapons + armor). Adding a new
// profiled item is two lines here plus a profile file under profiles/
// — no new class file needed. Behavior-varied items (potions, utility
// scrolls, currency, keys) stay as subclasses and live in Items.js.

const ITEM_PROFILES = {
    sword,
    axe,
    hammer,
    longSword,
    spear,
    bow,
    scrollOfFireball,
    scrollOfLightning,
    spiritBolt,
    shield,
    helmet,
    dagger,
    mace,
    quarterstaff,
    greatsword,
    crossbow,
    wand,
    buckler,
    towerShield,
    tome,
    orb,
    huntersCap,
    acolyteHood,
    wardenGreatHelm,
    realmCuirass,
    realmHauberk,
    huntersLeathers,
    acolyteRobe,
    wardenSabatons,
    huntersBoots,
    wandererShoes,
    wardenGauntlets,
    huntersGloves,
    acolyteWraps,
    ringOfMight,
    ringOfTheCat,
    ringOfFocus,
    ringOfVigor,
    wardingPendant,
    torch,
    lantern,
    lightsBeacon,
    lightboundReliquary,
    guildCharter,
    emberOfReturn,
    ...throwables,
    ...throwingWeapons,
    ...utilityFlasks,
    ...deployables,
    ...runes,
    ...reagents,
    ...tomes,
    ...affinityEssences,
    ...boosters,
    ...utilityScrolls,
    ...utilityItems,
    ...legendaries,
}

const CLASS_MAP = {
    MeleeWeapon,
    RangedWeapon,
    Armor,
    LightSource,
    Consumable,
    // Catalog categories whose system is pending (#47) all build through the
    // generic Consumable placeholder; their data rides on the profile. Worn
    // Accessory items use the Armor class (slot 'accessory').
    Throwable: ThrowableItem,   // SHIPPED (#47.1) — throw + AoE + ZoneEffect
    Draught: DraughtItem,       // SHIPPED (#47.8) — timed self-buff / cure
    Deployable: Consumable,
    Rune: Consumable,
    Reagent: Consumable,
    Tome: Consumable,
    Affinity: Consumable,   // affinity essence — use to attune (Consumable._attune)
    Booster: Consumable,
    Relic: Consumable,
    Accessory: Armor,
}

// Name + lore overrides from the designer's item archive (data/itemArchive.json),
// keyed by profile key. The archive is the editable CONTENT layer authored in the
// Dungeon Designer: when it holds an entry for a profile, its non-empty name / lore
// WIN over the coded defaults, so edits made in the designer show up in-game.
// Mechanics stay in the profile (code authoritative — the designer-scope principle).
// Importing the JSON is import-safe (pure data; the game bundles it at build, so
// the shipped lore is whatever was committed).
const ARCHIVE_BY_KEY = Object.fromEntries((itemArchive.items || []).map(it => [it.key, it]))

// Factory: construct a profiled item by name. Throws on unknown name
// so typos surface immediately rather than producing a broken sprite.
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
    // Apply the archive's authored name / lore (content layer) over the profile
    // defaults when present, so Dungeon Designer edits are reflected in-game.
    const authored = ARCHIVE_BY_KEY[profileName]
    if (authored) {
        if (authored.name) inst.name = authored.name
        if (authored.lore) inst.description = authored.lore
    }
    // Stamp the profile key so serialization can round-trip the item. A profile's
    // registry entry (Items.js) is a FACTORY FUNCTION, not a class, so `instanceof`
    // can't recover its name — ItemSerializer.classNameOf reads this instead.
    // Without it, profile items dropped out of FloorMemory/vault snapshots, which
    // emptied restored chests on floor revisits.
    inst.profileKey = profileName
    return inst
}

export { ITEM_PROFILES }
