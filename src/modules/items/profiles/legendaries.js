// The fifteen legendaries (scope doc §10.12, retuned and made real in §10.17).
//
// The art WAS ALREADY IN v5 — `public/art/items/legendary/` carries the original
// fourteen as 64px PixelLab icons, owned outright. The fifteenth, the Voidheart
// Staff (the user's "legendary staff for the Wizard"), rides a 32rogues frame
// because that sheet has no staff.
//
// NUMBERS, 2026-10-04. These were ported from v3 with v3's numbers, and v5's base
// gear had since been tuned past them: with the comparison screen in hand the
// user found "those legendary items are not stronger than base items" — and nine
// of fourteen were not. Every entry below now beats the best ordinary item in its
// slot (Realm Greatsword 2–9 +1 power; Realm Cuirass 3 armor +1 block; Warden
// Longbow 2–5 at range 8 +2 ranged power; Tome of Deep Frost 3–8 +2 spell power).
//
// `special` IS LIVE. §10.12 shipped the field as inert data and deferred the
// proc layer as its own §9 decision; §10.17 is that decision. The field is kept
// as the legendary's NAME for its effect (the Character screen prints it), and
// the effect itself is expressed in fields the engine already reads:
//
//   statContribution — any stat the hero's reducer sums (crit, block, dodge,
//                      barrier, magic power) PLUS four keys the reducer defaults
//                      to 0 and gear fills: thorns, fortune, sight, lastBreath
//   lifesteal        — Combat: the attacker heals this fraction of HP dealt
//   executeBelow     — Combat: { fraction, mult } damage multiplier when the
//                      victim is under `fraction` of its max HP
//   bonusVs          — Combat: { undead: mult } against enemyKinds' undead
//   splash / onHitStatus / empower — the §10.16 riders, same as any weapon
//   statPerFloor     — Armor: per-stat bonus × the floor index (Descent Pendant)
//   statWhenBloodied — Armor: per-stat bonus while the OWNER is under half HP
//
// `droppable: false` keeps them out of LOOT_KEYS, so they never appear in an
// ordinary chest, a loose floor item, or the shop's wildcard slot. They arrive
// only through the rare-chest roll in levels/spawnFromTable.js.
//
// `legendary: true` is what the Character screen reads for the violet name and
// what the rare-chest roll filters on.

const ICON = (file) => ({ sheet: "legendaries", file })
const art = (stem) => ({ art: ICON(`${stem}.png`) })

// Shared bow projectile, matching bow.js.
const BOW = { attackTile: 285, attackAngle: -Math.PI / 4, drawType: 'bow', attackPowerStat: 'rangedAttackPower' }

const LEGENDARIES = {
    // --- weapons ---
    emberBrand: {
        itemClass: 'MeleeWeapon', name: "Ember Brand", slot: 'mainhand',
        description: "A dark blade wreathed in living fire. Every cut burns, and the fire feeds on your own magic. Legendary.",
        tile: 375, ...art("ember_brand"), special: 'emberBrand',
        damageMin: 4, damageMax: 10, range: 2, damageFlavor: "fire",
        statContribution: { attackPower: 2 },
    },
    lifedrinker: {
        itemClass: 'MeleeWeapon', name: "Lifedrinker", slot: 'mainhand',
        description: "A void-tinged dagger that drinks the vitality it spills: a third of every wound returns to you. Legendary.",
        tile: 375, ...art("lifedrinker"), special: 'lifedrink',
        damageMin: 3, damageMax: 8, range: 2, weaponCategory: 'dagger',
        lifesteal: 0.34,
        statContribution: { dodge: 1 },
    },
    executioner: {
        itemClass: 'MeleeWeapon', name: "The Executioner", slot: 'mainhand',
        description: "A brutal headsman's greataxe. Strikes twice as hard at anything already on its knees. Legendary.",
        tile: 382, ...art("executioner"), special: 'executioner',
        damageMin: 5, damageMax: 12, range: 2, weaponCategory: 'axe',
        executeBelow: { fraction: 0.3, mult: 2 },
        statContribution: { critChance: 0.10 },
    },
    riftedge: {
        itemClass: 'MeleeWeapon', name: "Riftedge", slot: 'mainhand',
        description: "A jagged blade of fractured void-crystal. Half its cuts leave the wound unravelling. Legendary.",
        tile: 375, ...art("riftedge"), special: 'hollowTouched',
        damageMin: 4, damageMax: 9, range: 2,
        onHitStatus: { name: "Corrupted", chance: 0.5 },
        statContribution: { magicPower: 1 },
    },
    dawnbreaker: {
        itemClass: 'MeleeWeapon', name: "Dawnbreaker", slot: 'mainhand',
        description: "A radiant holy mace, anathema to the Void: half again as hard against the undead. Legendary.",
        tile: 380, ...art("dawnbreaker"), special: 'lightbound',
        damageMin: 4, damageMax: 9, range: 2, weaponCategory: 'blunt',
        bonusVs: { undead: 1.5 },
        statContribution: { block: 1, barrier: 1 },
    },
    stormcleave: {
        itemClass: 'MeleeWeapon', name: "Stormcleave", slot: 'mainhand',
        description: "A great axe crackling with caged lightning. Every blow bursts to those beside the mark and sometimes stuns. Legendary.",
        tile: 382, ...art("stormcleave"), special: 'cleaving',
        damageMin: 4, damageMax: 10, range: 2, damageFlavor: "lightning", weaponCategory: 'axe',
        splash: { radius: 1, mult: 0.5 },
        onHitStatus: { name: "Stun", chance: 0.15 },
    },
    farWhisper: {
        itemClass: 'RangedWeapon', name: "The Far Whisper", slot: 'mainhand',
        description: "An elven longbow that finds the unwary: it reaches further, bites deeper, and one arrow in five pins its mark. Legendary.",
        tile: 331, ...art("far_whisper"), special: 'huntersMark', weaponCategory: 'bow',
        ...BOW,
        damageMin: 3, damageMax: 7, range: 8, minRange: 3,
        onHitStatus: { name: "Rooted", chance: 0.2 },
        statContribution: { critChance: 0.15, rangedAttackPower: 2, dodge: 2 },
    },
    // The fifteenth (§10.17): the Wizard's legendary. A 32rogues frame, since the
    // PixelLab legendary sheet was drawn for the original fourteen.
    voidheartStaff: {
        itemClass: 'RangedWeapon', name: "Voidheart Staff", slot: 'mainhand',
        description: "A staff grown around a sliver of the Void. Every spell is heavier, a third of them unmake what they touch, and its ward holds. Legendary.",
        tile: 768, art: { sheet: "32rogues-items", name: "redCrystalStaff" }, tint: 0xc9a0ff,
        special: 'voidheart', weaponCategory: 'arcane',
        attackTile: 567, damageColor: 0xc084fc, castType: 'arcane',
        damageType: 'magic', attackPowerStat: 'magicPower',
        damageMin: 4, damageMax: 9, range: 6, minRange: 1,
        statContribution: { magicPower: 5, barrier: 2 },
        empower: {
            all: { damageMult: 1.25, onHitStatus: { name: "Corrupted", chance: 0.34 } },
            ward: { wardBonus: 6, wardTurns: 2 },
        },
    },

    // --- armor ---
    bramblecoat: {
        itemClass: 'Armor', name: "Bramblecoat", slot: 'body',
        description: "Spiked armor that bites back: anything that strikes you in reach is cut for it. Legendary.",
        tile: 135, ...art("bramblecoat"), special: 'thornmail', protection: 4,
        statContribution: { thorns: 4, block: 1 },
    },
    wardenplate: {
        itemClass: 'Armor', name: "Wardenplate", slot: 'body',
        description: "A guardian's crested plate. Nothing ordinary gets through it, and little gets past the shield-arm. Legendary.",
        tile: 135, ...art("wardenplate"), special: 'bulwark', protection: 6,
        statContribution: { block: 3 },
    },
    beaconCrown: {
        itemClass: 'Armor', name: "Beacon Crown", slot: 'head',
        description: "A golden crown set with a light-stone. It lights the dark like a held torch, and never burns down. Legendary.",
        tile: 135, ...art("beacon_crown"), special: 'lightbearer', protection: 3,
        statContribution: { sight: 2, barrier: 1 },
    },
    revenantMail: {
        itemClass: 'Armor', name: "Revenant Mail", slot: 'body',
        description: "Spectral chainmail that refuses death once: the blow that should kill you leaves you standing at a quarter. Legendary.",
        tile: 135, ...art("revenant_mail"), special: 'lastBreath', protection: 4,
        statContribution: { lastBreath: 1 },
    },

    // --- accessories ---
    // Armor with protection 0 or 1 — v5 has no Accessory class, and an accessory
    // is exactly what Armor already models. Their `special` IS the point of them,
    // and as of §10.17 it is real.
    midasBand: {
        itemClass: 'Armor', name: "Midas Band", slot: 'accessory',
        description: "A topaz ring that draws wealth: every coin you pick up is two. Legendary.",
        tile: 135, ...art("midas_band"), special: 'fortune', protection: 0,
        statContribution: { fortune: 1, dodge: 1 },
    },
    descentPendant: {
        itemClass: 'Armor', name: "Descent Pendant", slot: 'accessory',
        description: "A void-touched amulet that strengthens with the descent: +1 to every combat stat for each floor below the first. Legendary.",
        tile: 135, ...art("descent_pendant"), special: 'deepening', protection: 1,
        statPerFloor: { STR: 1, DEX: 1, CON: 1, Magic: 1 },
    },
    berserkersCharm: {
        itemClass: 'Armor', name: "Berserker's Charm", slot: 'accessory',
        description: "A primal charm that feeds on the wearer's pain: below half health you hit far harder and slip more blows. Legendary.",
        tile: 135, ...art("berserkers_charm"), special: 'berserkers', protection: 0,
        statWhenBloodied: { attackPower: 6, rangedAttackPower: 6, magicPower: 6, dodge: 2 },
    },
}

// Applied here rather than repeated on every entry: a legendary is never ordinary
// loot and is always flagged as legendary. Setting these in one place means
// adding a sixteenth cannot forget either.
for (const k of Object.keys(LEGENDARIES)) {
    LEGENDARIES[k].droppable = false
    LEGENDARIES[k].legendary = true
}

export const LEGENDARY_KEYS = Object.keys(LEGENDARIES)

export default LEGENDARIES
