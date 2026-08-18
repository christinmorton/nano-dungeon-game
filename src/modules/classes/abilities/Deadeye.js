import Ability from './Ability.js'
import bleed from '../../tags/bleed.js'
import stun from '../../tags/stun.js'
import { rangedShot } from '../../abilities/ranged.js'
import { addStatus, quickened, reaching, bump } from '../../abilities/traitDefs.js'

// Elf / ranged — the precise killing shot. A slow, deliberate aimed arrow that
// is a GUARANTEED critical hit (forceCrit threads through Combat.attack's crit
// roll, so it lands the weapon's full critMultiplier). Long range, long cooldown:
// the snipe you set up rather than spam. Can still be dodged — precision isn't
// unerring — but if it connects, it crits.
//
// Weapon-delegated: damage IS the bow's, magnified by the crit; no flat bonus.

export default class Deadeye extends Ability {
    name = 'Deadeye'
    icon = 31
    description = 'A precise aimed shot — a guaranteed critical hit. 1 AP, cd 6, long range. Requires a ranged weapon.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 8
    target = 'pickEnemy'

    // Weapon-delegated — damage is the bow's, magnified by the forced crit.
    damageType = 'physical'
    damageMult = 1
    bonusDamage = 0
    knockbackTiles = 0
    forceCrit = true     // guarantees the crit in Combat.attack

    // --- Progression ladder ----------------------------------------------------
    //   L1 : guaranteed-crit single shot
    //   L2 : +5 bonus damage                                              [boost]
    //   L3 : augment — Mortal Shot (+0.5x) | Hemorrhage (Bleed) | Knockdown (Stun + knockback)
    //   L4 : a trait slot — Quickened | Reaching (range) | Brutal (+dmg)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.bonusDamage += 5 },
    }

    augments = {
        mortalShot: { label: 'Mortal Shot', apply: a => { a.damageMult += 0.5 } },
        hemorrhage: addStatus('Hemorrhage', bleed),
        knockdown:  { label: 'Knockdown', apply: a => { a.appliesStatus = stun; a.knockbackTiles = 1 } },
    }

    traits = {
        quickened: quickened(2),
        reaching:  reaching(2),
        brutal:    bump('Brutal', 'bonusDamage', 8),
    }

    activate(hero, target) {
        return rangedShot(this, hero, target.entity)
    }
}
