export default {
    itemClass: 'MeleeWeapon',
    weaponCategory: 'blade',
    throwable: false,
    name: "Realm Greatsword",
    description: "A two-handed war-blade; needs both fists and a wide stance. Causes 2 to 9 damage.",
    tile: 424,
    art: { sheet: "32rogues-items", name: "greatSword" },
    note: "two-handed — intended to block the offhand slot (not yet enforced)",
    damageMin: 2,
    damageMax: 9,
    range: 2,
    statContribution: { attackPower: 1 },
}
