import Ability from './Ability.js'
import { bolt } from '../../abilities/patterns.js'
import freeze from '../../tags/freeze.js'
import { empowered, quickened, reaching } from '../../abilities/traitDefs.js'

// Ice damage — a shard of ice at a picked enemy: magicPower-scaled damage and
// Freeze (a hard skip, vs Rime Lance's lighter Slow). The Ice tree's single-target
// hard CC. Delivery = patterns.bolt (declarative fields + the freeze rider).

const ICE_TINT = 0x6ab8ff
const ICE_PROJECTILE_TILE = 574

export default class IceShard extends Ability {
    name = 'Ice Shard'
    icon = 31
    description = 'Launch an ice shard at an enemy (range 5): magicPower + 2..5 damage and Freeze (hard skip). 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 5
    target = 'pickEnemy'

    damageMin = 2
    damageMax = 5
    damageStat = 'magicPower'
    damageType = 'magic'
    appliesStatus = freeze
    fxColor = ICE_TINT

    // --- Progression ladder ----------------------------------------------------
    //   L1 : magicPower + 2..5 + Freeze
    //   L2 : +1/+2 damage                                                  [boost]
    //   L3 : augment — Shatterpoint (+dmg) | Rapid Cast (cd -1) | Far Reach (+range)
    //   L4 : a trait slot — Empowered | Quickened | Reaching
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 1; a.damageMax += 2 },
    }

    augments = {
        shatter:  { label: 'Shatterpoint', apply: a => { a.damageMin += 3; a.damageMax += 5 } },
        rapid:    { label: 'Rapid Cast', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
        farReach: { label: 'Far Reach', apply: a => { a.range += 3 } },
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
