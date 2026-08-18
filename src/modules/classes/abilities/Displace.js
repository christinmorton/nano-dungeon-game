import Ability from './Ability.js'
import { displace } from '../../abilities/patterns.js'
import daze from '../../tags/daze.js'
import { reaching, quickened, bump } from '../../abilities/traitDefs.js'

// Spatial tree — DISPLACE: blink a threat off you. Hurl a single enemy several
// tiles away through a fold in space (no damage, no wall-slam needed — pure
// distance). The escape/peel tool — open space between you and a bruiser. Composes
// the `displace` verb (push mode). The Jarring augment leaves the shoved foe Dazed.
// Library/unslotted (Spatial).

const SPATIAL_TINT = 0x9a7bff

export default class Displace extends Ability {
    name = 'Displace'
    icon = 31
    description = 'Blink an enemy 2 tiles away (range 5). No damage — pure displacement. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 5
    target = 'pickEnemy'
    fxColor = SPATIAL_TINT

    distance = 2
    jarring = false            // augment: Daze the displaced enemy

    // --- Progression ladder ----------------------------------------------------
    //   L1 : blink 2 tiles
    //   L2 : +1 tile                                                       [boost]
    //   L3 : augment — Forceful (+distance) | Far (+range) | Jarring (Daze)
    //   L4 : a trait slot — Forceful (+distance) | Reaching | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.distance += 1 },
    }

    augments = {
        forceful: { label: 'Forceful', apply: a => { a.distance += 2 } },
        far:      { label: 'Far',      apply: a => { a.range += 3 } },
        jarring:  { label: 'Jarring',  apply: a => { a.jarring = true } },
    }

    traits = {
        forceful:  bump('Forceful', 'distance', 1),
        reaching:  reaching(2),
        quickened: quickened(1),
    }

    activate(hero, target) {
        const victim = target.entity
        const result = displace(this, hero, victim, { distance: this.distance, mode: 'push' })
        if (this.jarring && victim.sprite) victim.addTag(daze)
        return result
    }
}
