import Ability from './Ability.js'
import { chain } from '../../abilities/patterns.js'

// Wizard A — chain lightning. Pick an enemy (range 5), then BOUNCE across a pack:
// each hit hops to the nearest not-yet-struck enemy within chainRadius, up to
// `arcs` jumps, weakening by arcFalloff each hop. An AoE damage-SPREADER — no CC.
// The Conductive trait is what beefs the chain (flat bonus damage + full-strength
// bounces). Delivery is the composable `chain` pattern.
//
// Cost lowered from design's 2 AP to 1 AP for prototype scope (same reasoning
// as Cleric Turn Undead).

const LIGHTNING_TINT = 0xfff66a
const LIGHTNING_PROJECTILE_TILE = 7

export default class ArcLightning extends Ability {
    name = 'Arc Lightning'
    icon = 31
    description = 'Bolt a picked enemy (range 5), then chain to nearby foes — magic damage that bounces across a pack, weakening each hop. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'pickEnemy'

    // Declarative payload — each link rolls from these (then x arcFalloff^hop, + bonus).
    damageMin = 6
    damageMax = 10
    damageStat = 'magicPower'
    damageType = 'magic'

    // Chain shape (ladder-tuned). arcs = BOUNCES after the first hit; arcFalloff
    // weakens each hop; bonusDamage is a flat add per link (raised by Conductive).
    arcs = 2
    chainRadius = 2
    arcFalloff = 0.85
    bonusDamage = 0

    // --- Progression ladder (AoE spreader; arc count is the core knob) ---
    //   L1 : 2 bounces, 6..10 dmg, 0.85 falloff
    //   L2 : 3 bounces, 9..13 dmg
    //   L3 : augment — Surge (+dmg) | Farreach (+range, +1 bounce) | Cascade (+2 bounces)
    //   L4 : 5 bounces, 12..17 dmg + a trait slot (Conductive / Tempest / Supercharged)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.arcs = 3; a.damageMin = 9; a.damageMax = 13 },
        4: a => { a.arcs = 5; a.damageMin = 12; a.damageMax = 17 },
    }

    augments = {
        surge:    { label: 'Surge',    apply: a => { a.damageMin += 3; a.damageMax += 5 } },
        farreach: { label: 'Farreach', apply: a => { a.chainRadius += 1; a.arcs += 1 } },
        cascade:  { label: 'Cascade',  apply: a => { a.arcs += 2 } },
    }

    traits = {
        // Conductive (your pick): flat bonus damage AND bounces stop weakening.
        conductive:   { label: 'Conductive',   apply: a => { a.bonusDamage += 3; a.arcFalloff = 1.0 } },
        tempest:      { label: 'Tempest',      apply: a => { a.arcs += 1 } },
        supercharged: { label: 'Supercharged', apply: a => { a.damageMax += 5 } },
    }

    activate(hero, target) {
        chain(this, hero, target.entity, {
            castType: 'arcane',
            projectile: { attackTile: LIGHTNING_PROJECTILE_TILE, tint: LIGHTNING_TINT },
            chainRadius: this.chainRadius,
            maxArcs: this.arcs,
            falloff: this.arcFalloff,
        })
    }
}
