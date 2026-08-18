import Ability from './Ability.js'
import bleed from '../../tags/bleed.js'
import sunder from '../../tags/sunder.js'
import poison from '../../tags/poison.js'
import { rangedShot } from '../../abilities/ranged.js'
import { quickened, reaching, bump } from '../../abilities/traitDefs.js'

// Elf / ranged — the bleeder. A barbed bow shot that leaves the target bleeding
// (Bleed — physical DoT) — chip damage that keeps working after the shot, good
// against tougher single targets. Weapon-delegated hit + the Bleed rider. The
// ranged cousin of Slash.

export default class BarbedArrow extends Ability {
    name = 'Barbed Arrow'
    icon = 31
    description = 'A barbed bow shot that causes Bleed. 1 AP, cd 3. Requires a ranged weapon.'
    cost = { ap: 1, mp: 0 }
    cooldown = 3
    range = 6
    target = 'pickEnemy'

    // Weapon-delegated — damage is the bow's; the rider is Bleed.
    damageType = 'physical'
    damageMult = 1
    bonusDamage = 0
    knockbackTiles = 0
    appliesStatus = bleed

    // --- Progression ladder ----------------------------------------------------
    //   L1 : bow shot + Bleed
    //   L2 : +3 bonus damage                                              [boost]
    //   L3 : augment — Serrated (Bleed + Sunder) | Venom Tip (Bleed + Poison) | Deep Cut (+dmg)
    //   L4 : a trait slot — Quickened | Reaching (range) | Overpower (+dmg)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.bonusDamage += 3 },
    }

    augments = {
        serrated: { label: 'Serrated', apply: a => { a.appliesStatus = [bleed, sunder] } },
        venomtip: { label: 'Venom Tip', apply: a => { a.appliesStatus = [bleed, poison] } },
        deep:     { label: 'Deep Cut', apply: a => { a.bonusDamage += 6 } },
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
