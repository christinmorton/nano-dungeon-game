// The deep-floor ice tier (§10.16) — the user's "tome for ice that can empower
// the rime lance". Its own hits slow (ice flavour) and burst to those beside the
// mark; Rime Lance lands far heavier and freezes one target in three in place.
export default {
    itemClass: 'RangedWeapon',
    weaponCategory: 'arcane',
    name: "Tome of Deep Frost",
    description: "A tome rimed with frost that never melts. Causes between 3 and 8 damage at range seven, slows, and chills those beside the mark.",
    tile: 768,
    art: { sheet: "32rogues-items", name: "tome" },
    tint: 0xb0e0ff,
    attackTile: 567,
    damageColor: 0x6ab8ff,
    castType: 'frost',
    damageType: 'magic',
    attackPowerStat: 'magicPower',
    damageFlavor: 'ice',
    damageMin: 3,
    damageMax: 8,
    range: 7,
    minRange: 3,
    statContribution: { magicPower: 2 },
    splash: { radius: 1, mult: 0.5 },
    minFloor: 3,
    empower: {
        ice: { damageBonus: 8, onHitStatus: { name: "Rooted", chance: 0.35 } },
        // The ward freezes solid: Barrier also raises a 20-point absorb pool.
        ward: { wardShield: 20, wardTurns: 1 },
    },
}
