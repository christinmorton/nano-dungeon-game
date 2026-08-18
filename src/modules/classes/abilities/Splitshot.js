import Ability from './Ability.js'
import slow from '../../tags/slow.js'
import { rangedVolley } from '../../abilities/ranged.js'
import { quickened, reaching, bump } from '../../abilities/traitDefs.js'

// Elf / ranged — the SCATTER shot. Loose one arrow at each of the nearest few
// enemies at once (no aim — the bow auto-picks the closest threats). The
// crowd-spreading counterpart to Piercing Loose's single-lane pierce.
//
// This is the §1.6 rename map's "Splitshot" built as its OWN ability (the pierce
// behavior stayed on Piercing Loose). Weapon-delegated: each arrow is a full bow
// hit (dodge/block/crit/flavor + projectile FX), via abilities/ranged.js.
// Ships at 2 targets; the deferred ladder grows it 2 -> 3 -> 4 (capped at 4).

export default class Splitshot extends Ability {
    name = 'Splitshot'
    icon = 31
    description = 'Loose arrows at the 2 nearest enemies at once. 1 AP, cd 3. Requires a ranged weapon.'
    cost = { ap: 1, mp: 0 }
    cooldown = 3
    range = 6
    target = 'self'

    // Weapon-delegated — damage is the bow's. Riders only.
    damageType = 'physical'
    damageMult = 1
    bonusDamage = 0
    knockbackTiles = 0
    targets = 2          // nearest-enemy count; ladder grows 2 -> 3 -> 4

    // --- Progression ladder ----------------------------------------------------
    //   L1 : 2 targets
    //   L2 : 3 targets                                                    [boost]
    //   L3 : augment — Scattershot (4 targets) | Hobbling (Slow) | Heavy Draw (+dmg)
    //   L4 : a trait slot — Quickened | Reaching (range) | Overpower (+dmg)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.targets = 3 },
    }

    augments = {
        scattershot: { label: 'Scattershot', apply: a => { a.targets = 4 } },          // cap 4
        hobbling:    { label: 'Hobbling', apply: a => { a.appliesStatus = slow } },
        heavy:       { label: 'Heavy Draw', apply: a => { a.damageMult += 0.25 } },
    }

    traits = {
        quickened: quickened(1),
        reaching:  reaching(2),
        overpower: bump('Overpower', 'bonusDamage', 5),
    }

    activate(hero) {
        return rangedVolley(this, hero)
    }
}
