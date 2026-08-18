import Ability from './Ability.js'
import { areaStrike } from '../../abilities/patterns.js'
import slow from '../../tags/slow.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// Earth damage — the big one: call down an AVALANCHE of rock over a clicked area
// (range 6), burying everything in a wide blast for heavy magic damage and leaving
// survivors Slowed under the debris. The Earth tree's large-AoE nuke (vs Tremor's
// self-centered petrify nova). Delivery = patterns.areaStrike (big circle).
// Library/unslotted.

const EARTH_TINT = 0x8a6f4a

export default class Avalanche extends Ability {
    name = 'Avalanche'
    icon = 31
    description = 'Bury a target area (range 6) under a rockslide: magicPower + 6..10 damage in a wide blast and Slow survivors. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 6
    target = 'aoeTile'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = EARTH_TINT

    damageMin = 6
    damageMax = 10
    damageStat = 'magicPower'
    damageType = 'magic'
    appliesStatus = slow

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 blast, magicPower + 6..10 + Slow
    //   L2 : +2/+3 damage                                                  [boost]
    //   L3 : augment — Rockfall (+dmg) | Wide Slide (+radius) | Rapid Cast (cd -1)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 2; a.damageMax += 3 },
    }

    augments = {
        rockfall: { label: 'Rockfall', apply: a => { a.damageMin += 4; a.damageMax += 6 } },
        wide:     { label: 'Wide Slide', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        rapid:    { label: 'Rapid Cast', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        empowered: empowered(3),
        enlarge:   { label: 'Enlarge', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        quickened: quickened(1),
    }

    activate(hero, target) {
        return areaStrike(this, hero, target.tile, { splash: true })
    }
}
