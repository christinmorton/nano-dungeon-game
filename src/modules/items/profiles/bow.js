export default {
    itemClass: 'RangedWeapon',
    weaponCategory: 'bow',
    throwable: false,
    name: "A Bow",
    description: "A bow and arrows. Causes between 1 and 3 damage and adds +1 dodge. Range is five tiles.",
    tile: 331,
    art: { sheet: "32rogues-items", name: "longBow" },
    attackTile: 285,
    attackAngle: -Math.PI / 4,
    drawType: 'bow',
    // Physical ranged: DEX primary, STR secondary (draw weight).
    // See documents/v3_magic_and_elements.md §"Magic scaling".
    attackPowerStat: 'rangedAttackPower',
    damageMin: 1,
    damageMax: 3,
    range: 7,
    minRange: 3,
    statContribution: { dodge: 1 },
}
