import Ability from './Ability.js'
import { bolt } from '../../abilities/patterns.js'
import slow from '../../tags/slow.js'
import rimesBite from '../../tags/rimesBite.js'
import { empowered, quickened, reaching, addStatus } from '../../abilities/traitDefs.js'

// Ice damage — a lance of ice at a picked enemy: magicPower-scaled damage + Slow.
// The Ice tree's reliable filler (the soft-CC bolt; Ice Shard is the hard-CC one).
// Delivery = patterns.bolt. Display name "Rime Lance" (locked rename ←Frost Bolt).
// Class kept FrostBolt to avoid registry churn.

const ICE_TINT = 0x6ab8ff
const ICE_PROJECTILE_TILE = 574

export default class FrostBolt extends Ability {
    name = 'Rime Lance'
    icon = 31
    description = 'A lance of ice at an enemy (range 5): magicPower + 2..5 damage and Slow. 1 AP, cd 2.'
    cost = { ap: 1, mp: 0 }
    cooldown = 2
    range = 5
    target = 'pickEnemy'

    damageMin = 2
    damageMax = 5
    damageStat = 'magicPower'
    damageType = 'magic'
    appliesStatus = slow
    fxColor = ICE_TINT

    // --- Progression ladder ----------------------------------------------------
    //   L1 : magicPower + 2..5 + Slow
    //   L2 : +1/+2 damage                                                  [boost]
    //   L3 : augment — Piercing Cold (+dmg) | Rime's Bite (add cold DoT) | Rapid Cast (cd -1)
    //   L4 : a trait slot — Empowered | Quickened | Reaching
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 1; a.damageMax += 2 },
    }

    augments = {
        piercing:  { label: 'Piercing Cold', apply: a => { a.damageMin += 3; a.damageMax += 4 } },
        rimesBite: addStatus("Rime's Bite", rimesBite),          // spec into cold attrition
        rapid:     { label: 'Rapid Cast', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        empowered: empowered(2),
        quickened: quickened(1),
        reaching:  reaching(2),
    }

    activate(hero, target) {
        bolt(this, hero, target.entity, {
            castType: 'frost',
            projectile: { attackTile: ICE_PROJECTILE_TILE, tint: ICE_TINT },
        })
    }
}
