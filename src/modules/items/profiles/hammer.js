export default {
    itemClass: 'MeleeWeapon',
    weaponCategory: 'blunt',
    throwable: true,
    name: "Warhammer",
    description: "A basic war hammer. Causes between 1 and 6 damage and adds +1 attack power.",
    tile: 380,
    art: { sheet: "32rogues-items", name: "shortWarhammer" },
    damageMin: 1,
    damageMax: 6,
    range: 2,
    statContribution: { attackPower: 1 },
}
