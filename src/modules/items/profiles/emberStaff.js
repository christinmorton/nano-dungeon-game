// The damage staff of the middle floors (scope doc §10.16).
export default {
    itemClass: 'RangedWeapon',
    weaponCategory: 'arcane',
    name: "Ember Staff",
    description: "A staff with a coal of living fire at its head. Causes between 3 and 6 damage, burns, and feeds your spells.",
    tile: 768,
    art: { sheet: "32rogues-items", name: "flameStaff" },
    attackTile: 567,
    damageColor: 0xff6633,
    castType: 'fire',
    damageType: 'magic',
    attackPowerStat: 'magicPower',
    damageFlavor: 'fire',
    damageMin: 3,
    damageMax: 6,
    range: 5,
    minRange: 1,
    statContribution: { magicPower: 2 },
    minFloor: 1,
    // Every damaging spell burns on two hits in five and lands a little heavier.
    empower: {
        all: { damageBonus: 2, onHitStatus: { name: "Burning", chance: 0.4 } },
    },
}
