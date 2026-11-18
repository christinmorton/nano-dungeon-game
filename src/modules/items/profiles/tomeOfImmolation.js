// The deep-floor fire AoE (scope doc §10.16). Splash victims go through the same
// weapon pipeline, so the fire flavour burns them too — one cast lights the pack.
export default {
    itemClass: 'RangedWeapon',
    weaponCategory: 'arcane',
    name: "Tome of Immolation",
    description: "A bound tome whose pages are always warm. Causes between 3 and 8 damage at range seven and sets the whole pack ablaze.",
    tile: 768,
    art: { sheet: "32rogues-items", name: "redBook" },
    attackTile: 567,
    damageColor: 0xff6633,
    castType: 'fire',
    damageType: 'magic',
    attackPowerStat: 'magicPower',
    damageFlavor: 'fire',
    damageMin: 3,
    damageMax: 8,
    range: 7,
    minRange: 3,
    statContribution: { magicPower: 2 },
    splash: { radius: 1, mult: 0.6 },
    minFloor: 3,
    // The deep-floor fire tier (§10.16): half of all spell hits burn, and every
    // spell lands heavier.
    empower: {
        all: { damageBonus: 4, onHitStatus: { name: "Burning", chance: 0.5 } },
    },
}
