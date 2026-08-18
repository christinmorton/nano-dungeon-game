import Ability from './Ability.js'
import { bolt } from '../../abilities/patterns.js'
import conductive from '../../tags/conductive.js'
import { empowered, quickened, reaching } from '../../abilities/traitDefs.js'

// Storm debuff — charge an enemy with current: light magic damage and Conductive,
// so they take +30% damage from ALL sources for a few turns. The burst SETUP —
// Conduct, then Levin Bolt / Thunderhead / Call Storm into the open target.
// Delivery = patterns.bolt (the conductive rider via appliesStatus). Library.

const STORM_TINT = 0x88bbff

export default class Conduct extends Ability {
    name = 'Conduct'
    icon = 31
    description = 'Charge an enemy with current (range 5): magicPower + 1..3 damage and Conductive — +30% damage taken from all sources for a few turns. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 5
    target = 'pickEnemy'

    damageMin = 1
    damageMax = 3
    damageStat = 'magicPower'
    damageType = 'magic'
    appliesStatus = conductive
    fxColor = STORM_TINT

    // --- Progression ladder ----------------------------------------------------
    //   L1 : magicPower + 1..3 + Conductive
    //   L2 : +1/+1 damage                                                  [boost]
    //   L3 : augment — Overcharged (+dmg) | Rapid Cast (cd -1) | Far Reach (+range)
    //   L4 : a trait slot — Empowered | Quickened | Reaching
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 1; a.damageMax += 1 },
    }

    augments = {
        overcharged: { label: 'Overcharged', apply: a => { a.damageMin += 3; a.damageMax += 4 } },
        rapid:       { label: 'Rapid Cast', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
        farReach:    { label: 'Far Reach', apply: a => { a.range += 3 } },
    }

    traits = {
        empowered: empowered(2),
        quickened: quickened(1),
        reaching:  reaching(2),
    }

    activate(hero, target) {
        bolt(this, hero, target.entity, {
            castType: 'arcane',
            projectile: { attackTile: 7, tint: STORM_TINT },
        })
    }
}
