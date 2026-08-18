import Ability from './Ability.js'
import { shapeStrike } from '../../abilities/patterns.js'
import slow from '../../tags/slow.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// Ice damage — a self-centered burst of frost: magicPower-scaled damage to every
// enemy in the circle and Slow them. The Ice tree's AoE soft-CC (shapeStrike +
// circle). Display name "Hoarfrost" (locked rename ←Frost Nova). Class kept
// FrostNova to avoid registry churn.

const ICE_TINT = 0x6ab8ff

export default class FrostNova extends Ability {
    name = 'Hoarfrost'
    icon = 31
    description = 'Burst of frost: magicPower + 2..5 damage to all enemies within 2 tiles and Slow them. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 2
    target = 'self'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = ICE_TINT

    damageMin = 2
    damageMax = 5
    damageStat = 'magicPower'
    damageType = 'magic'
    appliesStatus = slow

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 nova, magicPower + 2..5 + Slow
    //   L2 : +1/+2 damage                                                  [boost]
    //   L3 : augment — Wide Frost (+radius) | Biting Cold (+dmg) | Rapid Frost (cd -1)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 1; a.damageMax += 2 },
    }

    augments = {
        wide:   { label: 'Wide Frost', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        biting: { label: 'Biting Cold', apply: a => { a.damageMin += 2; a.damageMax += 3 } },
        rapid:  { label: 'Rapid Frost', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
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
