import Ability from './Ability.js'
import { afflict } from '../../abilities/patterns.js'
import sleep from '../../tags/sleep.js'
import { reaching, quickened, efficient } from '../../abilities/traitDefs.js'

// Arcane control pool ability — lull a target to sleep with no direct damage.
// The Sleep status makes them skip turns until they take a hit. Gives Sleep its
// first applier. Delivery = patterns.afflict (a bolt with no damage payload —
// dealHit applies appliesStatus directly when there's nothing to roll). Library.

const SLUMBER_TINT = 0x6a5acd
const SLUMBER_PROJECTILE_TILE = 567

export default class Slumber extends Ability {
    name = 'Slumber'
    icon = 31
    description = 'Lull an enemy to sleep (range 5) - they skip turns until struck. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 5
    target = 'pickEnemy'

    // No damage fields — a pure CC projectile. appliesStatus lands Sleep via
    // dealHit's no-payload branch. fxColor is the single color knob.
    appliesStatus = sleep
    fxColor = SLUMBER_TINT

    // --- Progression ladder (range / tempo — sleep duration lives on the tag) ---
    //   L1 : range 5, cd 5
    //   L2 : cd -1                                                         [boost]
    //   L3 : augment — Far Lull (+range) | Swift Lull (cd -2) | Effortless (0 AP)
    //   L4 : a trait slot — Reaching | Quickened | Efficient
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.cooldown = Math.max(0, a.cooldown - 1) },
    }

    augments = {
        farLull:    { label: 'Far Lull', apply: a => { a.range += 2 } },
        swiftLull:  { label: 'Swift Lull', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
        effortless: { label: 'Effortless Lull', apply: a => { a.cost = { ...a.cost, ap: 0 } } },
    }

    traits = {
        reaching:  reaching(2),
        quickened: quickened(1),
        efficient: efficient({ ap: 1 }),
    }

    activate(hero, target) {
        afflict(this, hero, target.entity, {
            castType: 'arcane',
            projectile: { attackTile: SLUMBER_PROJECTILE_TILE, tint: SLUMBER_TINT },
        })
    }
}
