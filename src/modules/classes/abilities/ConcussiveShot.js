import Ability from './Ability.js'
import daze from '../../tags/daze.js'
import slow from '../../tags/slow.js'
import stun from '../../tags/stun.js'
import { rangedShot } from '../../abilities/ranged.js'
import { quickened, reaching, bump } from '../../abilities/traitDefs.js'

// Elf / ranged — the stagger. A heavy bow shot that rocks the target: it's Dazed
// (reliably skips its next turn — lighter than a hard stun) and knocked back a
// tile, buying the skirmisher space. The "control, not a hard lock" shot.
//
// Base applies Daze; the deferred ladder offers a Slow-vs-Daze augment branch
// (user wants either available on the concussive path), so it can be retuned to a
// lingering Slow instead of the one-turn skip. Weapon-delegated hit + riders.

export default class ConcussiveShot extends Ability {
    name = 'Concussive Shot'
    icon = 31
    description = 'A heavy bow shot that dazes the target and knocks it back a tile. 1 AP, cd 5. Requires a ranged weapon.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 6
    target = 'pickEnemy'

    // Weapon-delegated — damage is the bow's; riders are Daze + knockback 1.
    damageType = 'physical'
    damageMult = 1
    bonusDamage = 0
    knockbackTiles = 1
    appliesStatus = daze

    // --- Progression ladder (the Slow-vs-Daze branch the chart flagged) ---------
    //   L1 : Daze + knockback 1
    //   L2 : knockback 2                                                  [boost]
    //   L3 : augment — Staggering (Daze + more knockback) | Hobbling (swap to Slow) |
    //        Concussion (upgrade to Stun — hard CC)
    //   L4 : a trait slot — Quickened | Reaching (range) | Overpower (+dmg)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.knockbackTiles = 2 },
    }

    augments = {
        staggering: { label: 'Staggering', apply: a => { a.appliesStatus = daze; a.knockbackTiles += 1 } },
        hobbling:   { label: 'Hobbling', apply: a => { a.appliesStatus = slow } },
        concussion: { label: 'Concussion', apply: a => { a.appliesStatus = stun } },   // hard CC
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
