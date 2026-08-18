import Ability from './Ability.js'
import slow from '../../tags/slow.js'
import { rangedFlurry } from '../../abilities/ranged.js'
import { addStatus, quickened, reaching, bump } from '../../abilities/traitDefs.js'

// Elf / ranged — the burst. Loose three arrows at one target in a single turn,
// stopping early if it drops. Pure single-target damage — the skirmisher's
// "focus it down" button. Weapon-delegated: each arrow is a full bow hit, so a
// strong bow + crit chance makes the flurry spike.

export default class RapidShot extends Ability {
    name = 'Rapid Shot'
    icon = 31
    description = 'Loose 3 quick arrows at one target. 1 AP, cd 4. Requires a ranged weapon.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 6
    target = 'pickEnemy'

    // Weapon-delegated — damage is the bow's, dealt `hits` times.
    damageType = 'physical'
    damageMult = 1
    bonusDamage = 0
    knockbackTiles = 0
    hits = 3

    // --- Progression ladder ----------------------------------------------------
    //   L1 : 3 arrows at one target
    //   L2 : 4 arrows                                                     [boost]
    //   L3 : augment — Hailstorm (5 arrows) | Crippling (Slow) | Heavy (+dmg)
    //   L4 : a trait slot — Quickened | Reaching (range) | Overpower (+dmg)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.hits = 4 },
    }

    augments = {
        hailstorm: { label: 'Hailstorm', apply: a => { a.hits = 5 } },
        crippling: addStatus('Crippling', slow),
        heavy:     { label: 'Heavy', apply: a => { a.damageMult += 0.2 } },
    }

    traits = {
        quickened: quickened(1),
        reaching:  reaching(2),
        overpower: bump('Overpower', 'bonusDamage', 4),
    }

    activate(hero, target) {
        return rangedFlurry(this, hero, target.entity)
    }
}
