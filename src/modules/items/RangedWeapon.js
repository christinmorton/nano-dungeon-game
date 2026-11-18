import Phaser from 'phaser'
import GenericItem from "./GenericItem.js"

// Generic ranged weapon — bows, throwing weapons, and the spell scrolls
// that fire as projectiles (Fireball, Lightning). Same profile pattern
// as MeleeWeapon. The animation/projectile layer reads attackTile,
// attackTexture, attackScale, attackAngle, damageColor, and castType
// from the profile so each weapon's visual identity is data, not code.
//
// Profile shape (see items/profiles/bow.js for the simple case and
// items/profiles/scrollOfFireball.js for the cast/projectile case):
//   itemClass: 'RangedWeapon'
//   name, description, tile, tint?
//   damageMin, damageMax
//   range, minRange?
//   slot                 — defaults to 'mainhand'
//   damageType           — 'physical' for arrows, 'magic' for spells
//   attackTile           — projectile sprite frame
//   attackTexture?       — overrides the default tiles texture (e.g.
//                          retroImpactLightning for chained sprites)
//   attackScale?         — projectile scale multiplier
//   attackAngle?         — radians offset for the arrow/bolt rotation
//   damageColor?         — floating damage-number tint
//   castType?            — drives a cast pulse before the projectile
//                          (Combat.js plays it via playCast)
//   drawType?            — drives a physical wind-up before the projectile
//                          (Combat.js plays it via playDraw, e.g. a bow draw)
//   statContribution     — flat per-stat additive map

export default class RangedWeapon extends GenericItem {
    constructor(x, y, profile) {
        super(x, y, profile.tile, profile.tint, profile.art)
        this.profile = profile
        this.name = profile.name
        this.description = profile.description
        this.weapon = true
        this.slot = profile.slot ?? 'mainhand'
        this.damageType = profile.damageType ?? 'physical'
        // No class-side default here: a bow profile needs 'rangedAttackPower'
        // and a spell scroll needs 'magicPower'. Forcing it onto the profile
        // keeps the read at attack-resolve time honest. See
        // documents/v3_magic_and_elements.md.
        this.attackPowerStat = profile.attackPowerStat ?? 'attackPower'
        this.damageFlavor = profile.damageFlavor ?? null

        // Visuals only get attached if the profile names them — otherwise
        // leave the field undefined so existing render code's `if (...)`
        // gates behave as before.
        this.attackTile = profile.attackTile
        if (profile.attackTexture) this.attackTexture = profile.attackTexture
        if (profile.attackScale != null) this.attackScale = profile.attackScale
        if (profile.attackAngle != null) this.attackAngle = profile.attackAngle
        if (profile.damageColor != null) this.damageColor = profile.damageColor
        if (profile.castType) this.castType = profile.castType
        if (profile.drawType) this.drawType = profile.drawType

        // Weapon riders (scope doc §10.16), read by Combat.attack after a hit
        // lands. Data on the profile, no code per weapon:
        //   splash { radius, mult }     — the other enemies within `radius` of the
        //                                 victim take `mult` of a normal hit
        //   onHitStatus { name, chance } — a status by registered name, rolled per hit
        if (profile.splash) this.splash = profile.splash
        if (profile.onHitStatus) this.onHitStatus = profile.onHitStatus
        // Spell empowerment (abilities/empower.js): what this weapon does to the
        // caster's SPELLS, keyed by element or `all`. A scroll is an amplifier.
        if (profile.empower) this.empower = profile.empower
        // Legendary procs (§10.17), read by Combat.attack like the riders above.
        if (profile.lifesteal) this.lifesteal = profile.lifesteal
        if (profile.executeBelow) this.executeBelow = profile.executeBelow
        if (profile.bonusVs) this.bonusVs = profile.bonusVs
        if (profile.legendary) this.legendary = true
        if (profile.special) this.special = profile.special
    }

    damage() {
        return Phaser.Math.Between(this.profile.damageMin, this.profile.damageMax)
    }

    range() {
        return this.profile.range ?? 5
    }

    minRange() {
        return this.profile.minRange ?? 0
    }

    statContribution(name) {
        const fromProfile = this.profile.statContribution?.[name] ?? 0
        return fromProfile + super.statContribution(name)
    }
}
