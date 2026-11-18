import Ability from './Ability.js'
import { rangedLine } from '../../abilities/ranged.js'

// Ranger / ranged — the line PIERCE. Loose one arrow down the lane toward the picked
// enemy; it punches through and strikes EVERY enemy in its path with full bow
// damage (a wall stops it). The skirmisher's answer to a line of foes.
//
// Renamed from Multishot (which capped at the target + one behind): the pierce
// identity is kept and generalized to the whole lane. The SCATTER "N bolts at N
// targets" idea lives in the separate new Splitshot. See
// documents/v3_ability_encyclopedia.md S3 + the coverage chart.
//
// Called "Piercing Loose" until 2026-09-10. "Loose" is the archery verb for
// releasing an arrow, which reads as a typo to anyone who does not already know
// it. The file keeps its name so the class ref in ranger.js stays put.
//
// Weapon-delegated: damage IS the equipped bow's (dodge/block/crit/flavor +
// projectile FX all apply per pierced enemy, via abilities/ranged.js). The arrow
// LOSES POWER as it punches through — each successive enemy takes 80% of the prior
// (falloff 0.8), so lining shots up still pays but it is not free AoE. v3 deferred
// bleed and sunder riders to the rank-up ladder; v5 has no ladder, so the base
// shot is the whole ability.

export default class PiercingLoose extends Ability {
    name = 'Piercing Shot'
    icon = 7
    description = 'Drive an arrow through a line of enemies for double damage, each taking 85% of the last. 1 AP, cd 3. Requires a ranged weapon.'
    cost = { ap: 1, mp: 0 }
    cooldown = 3
    range = 7
    target = 'pickEnemy'

    // Weapon-delegated — damage is the bow's. Riders only (mutated by a future ladder).
    damageType = 'physical'
    // 2.0, matching MightyBlow's multiplier. It was 1.0, which made this
    // STRICTLY WORSE THAN A FREE AUTO-ATTACK on a single target: a Ranger shot is
    // rangedAttackPower (DEX + STR/2 = 20) + the bow's 1-3, so ~22 either way —
    // except this one also spent a three-turn cooldown. The whole ability was
    // paying a cost for nothing unless two enemies happened to line up.
    damageMult = 2.0
    bonusDamage = 0
    knockbackTiles = 0
    falloff = 0.85        // each enemy pierced takes 85% of the previous one's hit

    activate(hero, target) {
        return rangedLine(this, hero, target.entity)
    }
}
