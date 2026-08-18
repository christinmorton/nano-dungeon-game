import Ability from './Ability.js'
import bleed from '../../tags/bleed.js'
import sunder from '../../tags/sunder.js'
import { rangedLine } from '../../abilities/ranged.js'
import { addStatus, quickened, reaching, bump } from '../../abilities/traitDefs.js'

// Elf / ranged — the line PIERCE. Loose one arrow down the lane toward the picked
// enemy; it punches through and strikes EVERY enemy in its path with full bow
// damage (a wall stops it). The skirmisher's answer to a line of foes.
//
// Renamed from Multishot (which capped at the target + one behind): the pierce
// identity is kept and generalized to the whole lane. The SCATTER "N bolts at N
// targets" idea lives in the separate new Splitshot. See
// documents/v3_ability_encyclopedia.md S3 + the coverage chart.
//
// Weapon-delegated: damage IS the equipped bow's (dodge/block/crit/flavor +
// projectile FX all apply per pierced enemy, via abilities/ranged.js). The arrow
// LOSES POWER as it punches through — each successive enemy takes 80% of the prior
// (falloff 0.8), so lining shots up still pays but it isn't free AoE. Riders (bleed
// / sunder) and damage-flavor coatings are deferred to the rank-up ladder + the
// future special-arrows system, not the base shot.

export default class PiercingLoose extends Ability {
    name = 'Piercing Loose'
    icon = 31
    description = 'Loose a piercing arrow in a line, striking every enemy in its path (each takes 80% of the last). 1 AP, cd 3. Requires a ranged weapon.'
    cost = { ap: 1, mp: 0 }
    cooldown = 3
    range = 7
    target = 'pickEnemy'

    // Weapon-delegated — damage is the bow's. Riders only (mutated by a future ladder).
    damageType = 'physical'
    damageMult = 1
    bonusDamage = 0
    knockbackTiles = 0
    falloff = 0.8         // each enemy pierced takes 80% of the previous one's hit

    // --- Progression ladder ----------------------------------------------------
    //   L1 : full bow damage · 0.8 falloff per pierce
    //   L2 : 1.15x damage                                                 [boost]
    //   L3 : augment — Penetrator (no falloff) | Barbed (Bleed) | Sundering (Sunder)
    //   L4 : a trait slot — Quickened | Reaching (range) | Overpower (+dmg)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMult = 1.15 },
    }

    augments = {
        penetrator: { label: 'Penetrator', apply: a => { a.falloff = 1.0 } },   // no power loss down the lane
        barbed:     addStatus('Barbed', bleed),
        sundering:  addStatus('Sundering', sunder),
    }

    traits = {
        quickened: quickened(1),
        reaching:  reaching(2),
        overpower: bump('Overpower', 'bonusDamage', 6),
    }

    activate(hero, target) {
        return rangedLine(this, hero, target.entity)
    }
}
