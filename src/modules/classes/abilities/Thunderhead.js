import Ability from './Ability.js'
import { shapeStrike } from '../../abilities/patterns.js'
import stun from '../../tags/stun.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// Storm control — call down a thunderhead: a self-centered burst that deals
// magicPower-scaled damage to every enemy in the circle and STUNS them (the AoE
// hard-CC nova — the canon lightning→Stun, scaled up). The tree's panic/setup
// button. Delivery = patterns.shapeStrike (+ circle). Library/unslotted.

const STORM_TINT = 0x6688ff

export default class Thunderhead extends Ability {
    name = 'Thunderhead'
    icon = 31
    description = 'Call down a thunderhead: magicPower + 3..6 damage to all enemies within 2 tiles and Stun them. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 2
    target = 'self'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = STORM_TINT

    damageMin = 3
    damageMax = 6
    damageStat = 'magicPower'
    damageType = 'magic'
    appliesStatus = stun

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 nova, magicPower + 3..6 + Stun
    //   L2 : +1/+2 damage                                                  [boost]
    //   L3 : augment — Wide Storm (+radius) | Overcharged (+dmg) | Rapid Cast (cd -1)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 1; a.damageMax += 2 },
    }

    augments = {
        wide:        { label: 'Wide Storm', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        overcharged: { label: 'Overcharged', apply: a => { a.damageMin += 3; a.damageMax += 4 } },
        rapid:       { label: 'Rapid Cast', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
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
