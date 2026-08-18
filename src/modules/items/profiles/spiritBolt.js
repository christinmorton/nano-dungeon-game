export default {
    itemClass: 'RangedWeapon',
    name: "spirit bolt",
    description: "A bolt of spectral curse-energy. Range five tiles; lays a curse on a struck foe.",
    tile: 575,
    // Void purple, so the projectile reads as spectral energy, not an arrow.
    tint: 0xa855f7,
    attackTile: 567,
    damageColor: 0xc084fc,
    // Purple cast pulse before the bolt (CAST_PRESETS.arcane) — a ghost gathering
    // spirit energy rather than drawing a bow.
    castType: 'arcane',
    damageType: 'magic',
    // Magic-typed — scales off Magic via magicPower. The 'curse' flavor makes
    // Combat.js apply Cursed on hit (STATUS_BY_FLAVOR). Lower damage than a
    // fireball to balance the curse rider.
    attackPowerStat: 'magicPower',
    damageFlavor: 'curse',
    damageMin: 1,
    damageMax: 3,
    range: 5,
    minRange: 2,
}
