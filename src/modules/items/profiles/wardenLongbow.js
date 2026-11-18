// The reach bow (scope doc §10.16): a tile further than anything else, and +2 to
// the stat every shot rolls from.
export default {
    itemClass: 'RangedWeapon',
    weaponCategory: 'bow',
    throwable: false,
    name: "Warden Longbow",
    description: "A tall yew bow of the Realm's wardens. Causes between 2 and 5 damage at range eight and steadies your aim.",
    tile: 331,
    art: { sheet: "32rogues-items", name: "longBow2" },
    attackTile: 285,
    attackAngle: -Math.PI / 4,
    drawType: 'bow',
    attackPowerStat: 'rangedAttackPower',
    damageMin: 2,
    damageMax: 5,
    range: 8,
    minRange: 3,
    statContribution: { dodge: 1, rangedAttackPower: 2 },
    minFloor: 1,
}
