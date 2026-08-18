import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { afflict } from '../../abilities/patterns.js'
import slow from '../../tags/slow.js'
import { reaching, quickened, efficient } from '../../abilities/traitDefs.js'

// Time tree — drag an enemy out of tempo: no direct damage, applies Slow (-1 MP
// per turn). The single-target debuff counterpart to Haste — peel a charger or
// kite a pack. Converted onto the afflict archetype; Slow applied explicitly in
// onImpact so the ladder can scale its duration. Library/unslotted.

const TIME_TINT = 0x6ab8ff
const SLOW_PROJECTILE_TILE = 567

export default class Slow extends Ability {
    name = 'Slow'
    icon = 31
    description = 'Slow an enemy (range 5) — -1 movement per turn for 3 turns. No damage. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 5
    target = 'pickEnemy'
    fxColor = TIME_TINT

    damageMin = 0
    damageMax = 0
    damageType = 'magic'

    slowTurns = 3

    // --- Progression ladder ----------------------------------------------------
    //   L1 : Slow 3 turns
    //   L2 : +1 turn                                                       [boost]
    //   L3 : augment — Lasting (+turns) | Far Slow (+range) | Mire (deeper — extra turn)
    //   L4 : a trait slot — Reaching | Quickened | Efficient
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.slowTurns += 1 },
    }

    augments = {
        lasting: { label: 'Lasting',  apply: a => { a.slowTurns += 3 } },
        farSlow: { label: 'Far Slow', apply: a => { a.range += 3 } },
        mire:    { label: 'Mire',     apply: a => { a.slowTurns += 1; a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        reaching:  reaching(2),
        quickened: quickened(1),
        efficient: efficient({ ap: 1 }),
    }

    activate(hero, target) {
        afflict(this, hero, target.entity, {
            castType: 'arcane',
            projectile: { attackTile: SLOW_PROJECTILE_TILE, tint: this.fxColor },
            onImpact: (v, result) => {
                if (result.killed || !v.sprite) return
                v.addTag(slow, this.slowTurns)
                gameLog.log(`${hero.name} drags ${v.name} out of step.`)
            },
        })
    }
}
