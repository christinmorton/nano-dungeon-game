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
    icon = 14
    description = 'Bolt a picked enemy (range 5), then chain to nearby foes: 2.2x spell power + 8..14, weakening each hop. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'pickEnemy'

    // Declarative payload — each link rolls from these (then x arcFalloff^hop, + bonus).
    // Rescaled 2026-10-04 (scope doc §10.16): was magicPower + 6..10.
    damageScale = 2.2
    damageMin = 8
    damageMax = 14
    damageStat = 'magicPower'
    // A lightning scroll or the Stormcaller Staff empowers this (§10.16): the
    // chain pattern strikes each target extra times and rolls a stun per hit.
    element = 'lightning'
    damageType = 'magic'

    // Chain shape (ladder-tuned). arcs = BOUNCES after the first hit; arcFalloff
    // weakens each hop; bonusDamage is a flat add per link (raised by Conductive).
    arcs = 2
    chainRadius = 2
    arcFalloff = 0.85
    bonusDamage = 0

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
