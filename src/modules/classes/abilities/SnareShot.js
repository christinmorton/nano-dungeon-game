import Ability from './Ability.js'
import rooted from '../../tags/rooted.js'
import slow from '../../tags/slow.js'
import bleed from '../../tags/bleed.js'
import { rangedShot } from '../../abilities/ranged.js'
import { quickened, reaching, bump } from '../../abilities/traitDefs.js'

// Elf / ranged — the immobilizer. A bow shot that pins the target in place
// (Rooted) — pegs a charging melee threat or a fleeing target so the skirmisher
// can keep its distance. Weapon-delegated hit + the Rooted rider.

export default class SnareShot extends Ability {
    name = 'Snare Shot'
    icon = 31
    description = 'A bow shot that roots the target in place. 1 AP, cd 5. Requires a ranged weapon.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 6
    target = 'pickEnemy'

    // Weapon-delegated — damage is the bow's; the rider is Rooted.
    damageType = 'physical'
    damageMult = 1
    bonusDamage = 0
    knockbackTiles = 0
    appliesStatus = rooted

    // --- Progression ladder ----------------------------------------------------
    //   L1 : bow shot + Root
    //   L2 : +3 bonus damage                                              [boost]
    //   L3 : augment — Crippling (Root + Slow) | Piercing Barb (Root + Bleed) | Heavy (+dmg)
    //   L4 : a trait slot — Quickened | Reaching (range) | Overpower (+dmg)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.bonusDamage += 3 },
    }

    augments = {
        crippling: { label: 'Crippling', apply: a => { a.appliesStatus = [rooted, slow] } },
        piercing:  { label: 'Piercing Barb', apply: a => { a.appliesStatus = [rooted, bleed] } },
        heavy:     { label: 'Heavy', apply: a => { a.damageMult += 0.3 } },
    }

    traits = {
        quickened: quickened(1),
        reaching:  reaching(2),
        overpower: bump('Overpower', 'bonusDamage', 5),
    }

    activate(hero, target) {
        return rangedShot(this, hero, target.entity)
    }
}
