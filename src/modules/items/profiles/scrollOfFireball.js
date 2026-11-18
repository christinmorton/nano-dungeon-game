export default {
    itemClass: 'RangedWeapon',
    weaponCategory: 'arcane',
    name: "A Scroll of Fireball",
    description: "A scroll of fireball. Causes between 2 and 5 damage and sets the target ablaze. Range is seven tiles.",
    tile: 768,
    // Real scroll art as of 2026-10-04 (scope doc §10.16); it drew the Kenney
    // tile tinted red before. Warm tint on the parchment so the two scrolls read
    // apart on a shelf.
    art: { sheet: "32rogues-items", name: "scroll" },
    tint: 0xffb080,
    attackTile: 567,
    damageColor: 0xff6633,
    castType: 'fire',
    damageType: 'magic',
    // Magic-typed spell — scales off Magic via magicPower. damageFlavor
    // 'fire' makes Combat.js dispatch the Burning status on hit.
    attackPowerStat: 'magicPower',
    damageFlavor: 'fire',
    damageMin: 2,
    damageMax: 5,
    range: 7,
    minRange: 3,
    // The starter scroll's empowerment (§10.16): a quarter of the Wizard's
    // damaging spell hits set the target ablaze.
    empower: {
        all: { onHitStatus: { name: "Burning", chance: 0.25 } },
    },
}
