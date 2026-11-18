// The deep-floor AoE staff (scope doc §10.16). `splash` is read by Combat: every
// other enemy within one tile of the victim takes half a hit through the same
// pipeline. `onHitStatus` rolls a Stun on better than one hit in three —
// lightning as a flavour never stuns (every hit would be too strong), so the
// chance lives on the weapon that earns it.
export default {
    itemClass: 'RangedWeapon',
    weaponCategory: 'arcane',
    name: "Stormcaller Staff",
    description: "A staff that calls the storm down. Causes between 3 and 7 damage, arcs to those beside the target, and sometimes stuns.",
    tile: 768,
    art: { sheet: "32rogues-items", name: "blueStaff" },
    attackTile: 567,
    damageColor: 0xfff66a,
    castType: 'arcane',
    damageType: 'magic',
    attackPowerStat: 'magicPower',
    damageFlavor: 'lightning',
    damageMin: 3,
    damageMax: 7,
    range: 6,
    minRange: 1,
    statContribution: { magicPower: 2 },
    splash: { radius: 1, mult: 0.5 },
    onHitStatus: { name: "Stun", chance: 0.35 },
    minFloor: 3,
    // The deep-floor lightning tier (§10.16): Arc Lightning strikes each target
    // THREE times, lightning spells stun better than one hit in three, and every
    // spell lands a little heavier.
    empower: {
        lightning: { extraHits: 2, onHitStatus: { name: "Stun", chance: 0.35 } },
        all: { damageBonus: 2 },
    },
}
