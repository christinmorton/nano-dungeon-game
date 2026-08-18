import Ability from './Ability.js'
import { knockback } from '../../abilities/universals.js'
import { shapeStrike } from '../../abilities/patterns.js'
import { empowered, quickened, wide } from '../../abilities/traitDefs.js'

// Wind damage — loose a cutting gust in a cone: light magicPower-scaled damage to
// every enemy caught, then knock them all back along the gust. The Wind tree's
// damage + displacement opener. Delivery = patterns.shapeStrike (+ cone) with a
// knockback rider on survivors. Library/unslotted.

const WIND_TINT = 0xcfe8ff

export default class GaleEdge extends Ability {
    name = 'Gale Edge'
    icon = 31
    description = 'Loose a cutting gust in a cone: magicPower + 2..4 damage and knock back everything caught. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 3
    target = 'direction'
    shape = { kind: 'cone', length: 3, spread: 1 }
    fxColor = WIND_TINT

    damageMin = 2
    damageMax = 4
    damageStat = 'magicPower'
    damageType = 'magic'
    knockbackTiles = 2

    // --- Progression ladder ----------------------------------------------------
    //   L3 augment — Howling Gale (+dmg) | Wide Gust (+spread) | Forceful (+knockback)
    //   L4 trait — Empowered | Wide (+spread) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.shape.length += 1 },
    }

    augments = {
        howling:  { label: 'Howling Gale', apply: a => { a.damageMin += 2; a.damageMax += 3 } },
        wideGust: { label: 'Wide Gust', apply: a => { a.shape.spread += 1 } },
        forceful: { label: 'Forceful', apply: a => { a.knockbackTiles += 1 } },
    }

    traits = {
        empowered: empowered(2),
        wide:      wide(1),
        quickened: quickened(1),
    }

    activate(hero, target) {
        const results = shapeStrike(this, hero, target.dx, target.dy, { splash: true })
        for (const { entity, result } of results) {
            if (!result.killed) knockback(entity, target.dx, target.dy, this.knockbackTiles)
        }
        return results
    }
}
