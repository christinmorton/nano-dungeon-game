import Ability from './Ability.js'
import { leap } from '../../abilities/patterns.js'
import { reaching, quickened, efficient } from '../../abilities/traitDefs.js'

// Wind mobility — ride a column of wind: leap to a chosen tile, soaring OVER
// enemies and terrain (vs a dash that stops at the first wall). The Wind tree's
// repositioning escape/engage. Delivery = patterns.leap (lands on open floor).
// Library/unslotted.

const WIND_TINT = 0xcfe8ff

export default class Updraft extends Ability {
    name = 'Updraft'
    icon = 31
    description = 'Ride a column of wind: leap to a chosen tile within range 4, soaring over enemies and terrain. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 4
    target = 'pickTile'
    fxColor = WIND_TINT

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.range += 1 },
    }

    augments = {
        soar:      { label: 'Soar', apply: a => { a.range += 3 } },
        rapid:     { label: 'Rapid', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
        effortless:{ label: 'Effortless', apply: a => { a.cost = { ...a.cost, ap: 0 } } },
    }

    traits = {
        reaching:  reaching(2),
        quickened: quickened(1),
        efficient: efficient({ ap: 1 }),
    }

    activate(hero, target) {
        return leap(this, hero, target)
    }
}
