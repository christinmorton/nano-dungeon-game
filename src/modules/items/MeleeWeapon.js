import Phaser from 'phaser'
import GenericItem from "./GenericItem.js"

// Generic melee weapon. Identity (Sword vs Hammer vs Spear) comes from
// a profile passed into the constructor — mirrors the BaseHero +
// profile pattern. New melee weapons are pure-data additions in
// items/profiles/<name>.js plus a registry entry; no new subclass.
//
// Profile shape (see items/profiles/sword.js for canonical example):
//   itemClass: 'MeleeWeapon'   — selects this class via makeItem
//   name, description, tile, tint?
//   damageMin, damageMax       — Phaser.Math.Between bounds for damage()
//   range                      — attack reach in tiles (defaults to 2)
//   slot                       — defaults to 'mainhand'
//   weaponCategory             — physical FORM of the weapon, distinct from the
//                                damage-mitigation `damageType`. 'blade' (default),
//                                'blunt', 'dagger', 'axe', 'spear', or natural
//                                'fist' / 'natural'. Abilities gate on it (Bash
//                                needs blunt; see Ability.requiresWeaponCategory).
//   throwable                  — can it be hurled (throwing combat style)? Opt-in,
//                                defaults false. daggers/axes/spears/hammers true.
//   damageType                 — defaults to 'physical'
//   attackPowerStat            — which derived stat scales the power
//                                base ('attackPower' for melee STR-driven,
//                                'rangedAttackPower' for DEX-driven,
//                                'magicPower' for spells). Defaults to
//                                'attackPower'. See documents/v3_magic_and_elements.md
//   damageFlavor               — null by default; set to 'fire' / 'ice' /
//                                'lightning' / 'earth' / 'wind' / etc. for
//                                enchanted or intrinsically-elemental weapons
//   statContribution           — flat per-stat additive map

export default class MeleeWeapon extends GenericItem {
    constructor(x, y, profile) {
        super(x, y, profile.tile, profile.tint, profile.art)
        this.profile = profile
        this.name = profile.name
        this.description = profile.description
        this.weapon = true
        this.slot = profile.slot ?? 'mainhand'
        this.damageType = profile.damageType ?? 'physical'
        this.attackPowerStat = profile.attackPowerStat ?? 'attackPower'
        this.damageFlavor = profile.damageFlavor ?? null
        // Physical form for ability gating (Bash → blunt). Defaults to 'blade';
        // the bludgeoning weapons tag themselves 'blunt'. (Spear/axe can gain
        // 'pierce'/'axe' when a pierce/axe ability needs them — deferred.)
        this.weaponCategory = profile.weaponCategory ?? 'blade'
        // Throw-suitability for the throwing combat style: can this weapon be
        // hurled as a "throw your equipped weapon" attack (Hurl Weapon, a generic
        // Throw Weapon)? Daggers/axes/spears/hammers yes; swords/maces/staves no.
        // Opt-in (defaults false) — the self-contained throws (Throw Knives) carry
        // their own ammo and don't read this.
        this.throwable = profile.throwable ?? false
        // Weapon riders (scope doc §10.16) — same two fields RangedWeapon copies,
        // so a legendary blade can burst or stun through the same Combat path.
        if (profile.splash) this.splash = profile.splash
        if (profile.onHitStatus) this.onHitStatus = profile.onHitStatus
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
        return this.profile.range ?? 2
    }

    statContribution(name) {
        const fromProfile = this.profile.statContribution?.[name] ?? 0
        return fromProfile + super.statContribution(name)
    }
}
