// Mid-range control (scope doc §10.16). Ice is a real flavour: every hit Slows.
export default {
    itemClass: 'RangedWeapon',
    weaponCategory: 'arcane',
    name: "Rime Rod",
    description: "A rod of blue crystal that bleeds cold. Causes between 2 and 5 damage and slows what it strikes.",
    tile: 768,
    art: { sheet: "32rogues-items", name: "blueCrystalStaff" },
    attackTile: 567,
    damageColor: 0x6ab8ff,
    castType: 'frost',
    damageType: 'magic',
    attackPowerStat: 'magicPower',
    damageFlavor: 'ice',
    damageMin: 2,
    damageMax: 5,
    range: 5,
    minRange: 1,
    statContribution: { magicPower: 1 },
    minFloor: 1,
    // Rime Lance hits harder and one in five freezes the target in place.
    empower: {
        ice: { damageBonus: 4, onHitStatus: { name: "Rooted", chance: 0.2 } },
        // A rime ward lingers: Barrier holds one turn longer.
        ward: { wardTurns: 1 },
    },
}
