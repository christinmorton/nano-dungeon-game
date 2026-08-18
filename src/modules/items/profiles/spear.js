export default {
    itemClass: 'MeleeWeapon',
    weaponCategory: 'spear',
    throwable: true,
    name: "A Spear",
    description: "A basic spear that attacks from range. Adds +1 dodge.",
    tile: 179,
    art: { sheet: "32rogues-items", name: "spear" },
    damageMin: 2,
    damageMax: 5,
    range: 3,
    statContribution: { dodge: 1 },
}
