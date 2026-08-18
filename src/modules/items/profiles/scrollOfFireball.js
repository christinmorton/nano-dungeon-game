export default {
    itemClass: 'RangedWeapon',
    name: "A Scroll of Fireball",
    description: "A scroll of fireball. Causes between 1 and 4 damage. Range is four tiles.",
    tile: 768,
    tint: 0xdd0000,
    attackTile: 567,
    damageColor: 0xc084fc,
    castType: 'fire',
    damageType: 'magic',
    // Magic-typed spell — scales off Magic via magicPower. damageFlavor
    // 'fire' makes Combat.js dispatch the Burning status on hit.
    attackPowerStat: 'magicPower',
    damageFlavor: 'fire',
    damageMin: 1,
    damageMax: 4,
    range: 7,
    minRange: 3,
}
