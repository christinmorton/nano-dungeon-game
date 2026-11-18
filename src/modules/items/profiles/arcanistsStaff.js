// THE spell-power staff (scope doc §10.16). No element, shorter reach — its whole
// point is +3 to the stat every Wizard spell rolls from, and a little barrier
// for the caster who stands close enough to use it.
export default {
    itemClass: 'RangedWeapon',
    weaponCategory: 'arcane',
    name: "Arcanist's Staff",
    description: "A gilded focus that makes every spell heavier. Causes between 3 and 7 damage at close range.",
    tile: 768,
    art: { sheet: "32rogues-items", name: "goldenStaff" },
    attackTile: 567,
    damageColor: 0xc084fc,
    castType: 'arcane',
    damageType: 'magic',
    attackPowerStat: 'magicPower',
    damageMin: 3,
    damageMax: 7,
    range: 4,
    minRange: 1,
    statContribution: { magicPower: 3, barrier: 1 },
    minFloor: 2,
    // No element, no rider — pure amplification: every spell, fifteen percent
    // more, on top of the +3 spell power the multipliers already feed on.
    empower: {
        all: { damageMult: 1.15 },
        // The defender's staff too: Barrier resists more and holds longer.
        ward: { wardBonus: 4, wardTurns: 2 },
    },
}
