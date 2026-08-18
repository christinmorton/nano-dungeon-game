import Ability from './Ability.js'
import { shapeStrike } from '../../abilities/patterns.js'
import petrify from '../../tags/petrify.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// Earth control — shake the earth around you: magicPower-scaled damage to every
// enemy in the circle and Petrify them (turn to stone — hard CC). The self-centered
// lockdown nova. Delivery = patterns.shapeStrike (+ circle). Library/unslotted.

const EARTH_TINT = 0x9a7b4f

export default class Tremor extends Ability {
    name = 'Tremor'
    icon = 31
    description = 'Shake the earth: magicPower + 2..5 damage to all enemies within 2 tiles and Petrify them. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 2
    target = 'self'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = EARTH_TINT

    damageMin = 2
    damageMax = 5
    damageStat = 'magicPower'
    damageType = 'magic'
    appliesStatus = petrify

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 nova, magicPower + 2..5 + Petrify
    //   L2 : +1/+2 damage                                                  [boost]
    //   L3 : augment — Wide Quake (+radius) | Crushing (+dmg) | Rapid (cd -1)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 1; a.damageMax += 2 },
    }

    augments = {
        wide:     { label: 'Wide Quake', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        crushing: { label: 'Crushing', apply: a => { a.damageMin += 2; a.damageMax += 3 } },
        rapid:    { label: 'Rapid Quake', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        empowered: empowered(2),
        enlarge:   { label: 'Enlarge', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        quickened: quickened(1),
    }

    activate(hero) {
        return shapeStrike(this, hero, 0, 0, { splash: true })
    }
}
