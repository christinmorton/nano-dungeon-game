// The Wizard's second starter-tier scroll (scope doc §10.16). Lightning is a
// visual-only flavour in Combat (every hit stunning was judged too strong), so
// this one carries no status — its edge over the fireball is the roll and the
// point of spell power.
export default {
    itemClass: 'RangedWeapon',
    weaponCategory: 'arcane',
    name: "Scroll of Lightning",
    description: "A crackling scroll. Causes between 2 and 6 damage at range seven and sharpens your spells.",
    tile: 768,
    art: { sheet: "32rogues-items", name: "scroll2" },
    tint: 0xfff0a0,
    attackTile: 567,
    damageColor: 0xfff66a,
    castType: 'arcane',
    damageType: 'magic',
    attackPowerStat: 'magicPower',
    damageFlavor: 'lightning',
    damageMin: 2,
    damageMax: 6,
    range: 7,
    minRange: 3,
    statContribution: { magicPower: 1 },
    minFloor: 1,
    // The scroll's point (§10.16): Arc Lightning strikes every target it reaches
    // TWICE, and lightning spells stun one hit in five.
    empower: {
        lightning: { extraHits: 1, onHitStatus: { name: "Stun", chance: 0.2 } },
    },
}
