import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { afflict } from '../../abilities/patterns.js'
import stasis from '../../tags/stasis.js'
import { reaching, quickened, bump } from '../../abilities/traitDefs.js'

// Time tree — lock a single enemy out of time: no damage, applies Stasis (skip
// turns) for longer than the AoE nova. The single-target hard CC — freeze the one
// dangerous foe and deal with the rest. Converted onto the afflict archetype;
// Stasis applied explicitly in onImpact so the ladder can scale its duration.
// Library/unslotted.

const TIME_TINT = 0xbfe6ff
const LOCK_PROJECTILE_TILE = 567

export default class Lock extends Ability {
    name = 'Lock'
    icon = 31
    description = 'Lock an enemy out of time (range 5) — Stasis (skip turns) for 3 turns. No damage. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'pickEnemy'
    fxColor = TIME_TINT

    damageMin = 0
    damageMax = 0
    damageType = 'magic'

    lockTurns = 3

    // --- Progression ladder ----------------------------------------------------
    //   L1 : Stasis 3 turns
    //   L2 : +1 turn                                                       [boost]
    //   L3 : augment — Imprison (+turns) | Far Lock (+range) | Rapid (cd -1)
    //   L4 : a trait slot — Reaching | Quickened | Lasting (+turns)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.lockTurns += 1 },
    }

    augments = {
        imprison: { label: 'Imprison', apply: a => { a.lockTurns += 2 } },
        farLock:  { label: 'Far Lock', apply: a => { a.range += 3 } },
        rapid:    { label: 'Rapid',    apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        reaching:  reaching(2),
        quickened: quickened(1),
        lasting:   bump('Lasting', 'lockTurns', 1),
    }

    activate(hero, target) {
        afflict(this, hero, target.entity, {
            castType: 'arcane',
            projectile: { attackTile: LOCK_PROJECTILE_TILE, tint: this.fxColor },
            onImpact: (v, result) => {
                if (result.killed || !v.sprite) return
                v.addTag(stasis, this.lockTurns)
                gameLog.log(`${hero.name} locks ${v.name} out of time.`)
            },
        })
    }
}
