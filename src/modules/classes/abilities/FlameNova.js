import Ability from './Ability.js'
import { shapeStrike } from '../../abilities/patterns.js'
import burning from '../../tags/burning.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// Fire damage — erupt in a NOVA of flame around the caster: magicPower-scaled fire
// damage to every enemy within the circle, igniting them (Burning). The
// self-centered AoE (shapeStrike + a circle shape). Display name "Pyreburst"
// (locked rename ←Flame Nova). Class kept FlameNova to avoid registry churn.

const FIRE_TINT = 0xff7733

export default class FlameNova extends Ability {
    name = 'Pyreburst'
    icon = 31
    description = 'Erupt in a nova of flame: magicPower + 2..5 damage to all enemies within 2 tiles, igniting them (Burning). 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 2
    target = 'self'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = FIRE_TINT

    damageMin = 2
    damageMax = 5
    damageStat = 'magicPower'
    damageType = 'magic'
    appliesStatus = burning

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 nova, magicPower + 2..5 + Burning
    //   L2 : +1/+2 damage                                                  [boost]
    //   L3 : augment — Wide Eruption (+radius) | Searing (+dmg) | Rapid Eruption (cd -1)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 1; a.damageMax += 2 },
    }

    augments = {
        wide:    { label: 'Wide Eruption', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        searing: { label: 'Searing', apply: a => { a.damageMin += 2; a.damageMax += 3 } },
        rapid:   { label: 'Rapid Eruption', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
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
