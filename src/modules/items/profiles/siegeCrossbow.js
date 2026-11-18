// The deep-floor AoE crossbow (scope doc §10.16): heavy bolts that burst on
// impact. `splash` is read by Combat — the enemies beside the target take half a
// hit through the same pipeline.
export default {
    itemClass: 'RangedWeapon',
    weaponCategory: 'bow',
    throwable: false,
    name: "Siege Crossbow",
    description: "A windlass crossbow firing bursting bolts. Causes between 4 and 8 damage at range six and wounds those beside the mark.",
    tile: 331,
    art: { sheet: "32rogues-items", name: "largeCrossbow" },
    attackTile: 285,
    attackAngle: -Math.PI / 4,
    drawType: 'bow',
    attackPowerStat: 'rangedAttackPower',
    damageMin: 4,
    damageMax: 8,
    range: 6,
    minRange: 2,
    statContribution: { block: 1 },
    splash: { radius: 1, mult: 0.5 },
    minFloor: 3,
}
