// Legendary uniques (§14) — named items that each carry one "special" affix,
// using the original PixelLab legendary art (the 'legendaries' inventory-icon
// sheet). The affix/proc EFFECT layer is PENDING (the `special` field is inert
// data for now); see known-issues #47. droppable:false — these want a special
// drop pool (boss/vault), not the uniform table. Stats are first-draft.
const A = (file) => ({ sheet: "legendaries", file })

const LEGENDARIES = {
    emberBrand: { itemClass: 'MeleeWeapon', name: "Ember Brand", description: "A dark blade wreathed in living fire. Legendary.", tile: 375, art: A("ember_brand.png"), slot: 'mainhand', special: 'emberBrand', damageMin: 2, damageMax: 7, range: 2, damageFlavor: "fire" },
    lifedrinker: { itemClass: 'MeleeWeapon', name: "Lifedrinker", description: "A void-tinged dagger that drinks the vitality it spills. Legendary.", tile: 375, art: A("lifedrinker.png"), slot: 'mainhand', special: 'lifedrink', damageMin: 2, damageMax: 5, range: 2 },
    executioner: { itemClass: 'MeleeWeapon', name: "The Executioner", description: "A brutal headsman's greataxe. Legendary.", tile: 382, art: A("executioner.png"), slot: 'mainhand', special: 'executioner', damageMin: 3, damageMax: 9, range: 2 },
    riftedge: { itemClass: 'MeleeWeapon', name: "Riftedge", description: "A jagged blade of fractured void-crystal. Legendary.", tile: 375, art: A("riftedge.png"), slot: 'mainhand', special: 'hollowTouched', damageMin: 2, damageMax: 8, range: 2 },
    dawnbreaker: { itemClass: 'MeleeWeapon', name: "Dawnbreaker", description: "A radiant holy mace, anathema to the Void. Legendary.", tile: 380, art: A("dawnbreaker.png"), slot: 'mainhand', special: 'lightbound', damageMin: 2, damageMax: 7, range: 2 },
    stormcleave: { itemClass: 'MeleeWeapon', name: "Stormcleave", description: "A great axe crackling with caged lightning. Legendary.", tile: 382, art: A("stormcleave.png"), slot: 'mainhand', special: 'cleaving', damageMin: 2, damageMax: 8, range: 2, damageFlavor: "lightning" },
    farWhisper: { itemClass: 'RangedWeapon', name: "The Far Whisper", description: "An elven longbow that finds the unwary. Legendary.", tile: 331, art: A("far_whisper.png"), slot: 'mainhand', special: 'huntersMark', attackTile: 285, attackAngle: -Math.PI / 4, drawType: 'bow', attackPowerStat: 'rangedAttackPower', damageMin: 2, damageMax: 5, range: 7, minRange: 3 },

    bramblecoat: { itemClass: 'Armor', name: "Bramblecoat", description: "Spiked armor that bites back. Legendary.", tile: 135, art: A("bramblecoat.png"), slot: 'body', special: 'thornmail', protection: 3 },
    wardenplate: { itemClass: 'Armor', name: "Wardenplate", description: "A guardian's crested plate. Legendary.", tile: 135, art: A("wardenplate.png"), slot: 'body', special: 'bulwark', protection: 4 },
    beaconCrown: { itemClass: 'Armor', name: "Beacon Crown", description: "A golden crown set with a light-stone. Legendary.", tile: 135, art: A("beacon_crown.png"), slot: 'head', special: 'lightbearer', protection: 2 },
    revenantMail: { itemClass: 'Armor', name: "Revenant Mail", description: "Spectral chainmail that refuses death once. Legendary.", tile: 135, art: A("revenant_mail.png"), slot: 'body', special: 'lastBreath', protection: 2 },

    midasBand: { itemClass: 'Armor', name: "Midas Band", description: "A topaz ring that draws wealth. Legendary.", tile: 135, art: A("midas_band.png"), slot: 'accessory', special: 'fortune', protection: 0 },
    descentPendant: { itemClass: 'Armor', name: "Descent Pendant", description: "A void-touched amulet that strengthens with the descent. Legendary.", tile: 135, art: A("descent_pendant.png"), slot: 'accessory', special: 'deepening', protection: 0 },
    berserkersCharm: { itemClass: 'Armor', name: "Berserker's Charm", description: "A primal charm that feeds on the wearer's pain. Legendary.", tile: 135, art: A("berserkers_charm.png"), slot: 'accessory', special: 'berserkers', protection: 0 },
}

// Legendaries stay out of the uniform drop pool — they want a special / boss /
// vault drop (built with the affix-effect system later, #47).
for (const k of Object.keys(LEGENDARIES)) LEGENDARIES[k].droppable = false

export default LEGENDARIES
