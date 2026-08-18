export default {
    itemClass: 'RangedWeapon',
    name: "A Scroll of Lightning",
    description: "A scroll of Lightning. Causes between 1 and 2 damage. Range is seven tiles.",
    tile: 768,
    tint: 0x0022ff,
    attackTile: 7,
    attackTexture: "retroImpactLightning",
    attackScale: 0.25,
    // Bolt sprite (frame 7) is vertical; rotate it to aim along the attack
    // axis (issue #26). Eyeball the sign if it points the wrong way.
    attackAngle: -Math.PI / 2,
    damageColor: 0xc084fc,
    castType: 'frost',
    damageType: 'magic',
    // Magic-typed spell. damageFlavor 'lightning' has no status mapping
    // in v1 (Stun lands with the tag rework) — flavor still drives the
    // visual identity and future weakness interactions.
    attackPowerStat: 'magicPower',
    damageFlavor: 'lightning',
    damageMin: 1,
    damageMax: 2,
    range: 7,
    minRange: 3,
}
