// The status bow (scope doc §10.16). Poison is a real flavour in Combat, so every
// arrow that lands poisons — the Ranger's answer to the Venomous spider.
export default {
    itemClass: 'RangedWeapon',
    weaponCategory: 'bow',
    throwable: false,
    name: "Serpent Bow",
    description: "A bow strung with something that was alive. Causes between 3 and 6 damage at range seven; every arrow poisons.",
    tile: 331,
    art: { sheet: "32rogues-items", name: "longBow" },
    tint: 0x9ee07a,
    attackTile: 285,
    attackAngle: -Math.PI / 4,
    drawType: 'bow',
    attackPowerStat: 'rangedAttackPower',
    damageFlavor: 'poison',
    damageColor: 0x66dd55,
    damageMin: 3,
    damageMax: 6,
    range: 7,
    minRange: 3,
    statContribution: { dodge: 1 },
    minFloor: 2,
}
