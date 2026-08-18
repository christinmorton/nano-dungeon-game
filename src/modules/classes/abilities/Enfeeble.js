import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { afflict } from '../../abilities/patterns.js'
import weaken from '../../tags/weaken.js'
import { reaching, quickened, efficient } from '../../abilities/traitDefs.js'

// Void tree — sap an enemy's strength with no direct damage; applies Weaken
// (-attackPower). Reassigned from the old control pool to Void (the will-breaking
// caster). Converted onto the afflict archetype; Weaken applied explicitly in
// onImpact so the ladder can scale the penalty and duration. Library/unslotted.

const ENFEEBLE_TINT = 0x8a6fb0
const ENFEEBLE_PROJECTILE_TILE = 567

export default class Enfeeble extends Ability {
    name = 'Enfeeble'
    icon = 31
    description = "Sap an enemy's strength (range 5) — applies Weaken (-2 attack for 3 turns). 1 AP, cd 4."
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 5
    target = 'pickEnemy'
    fxColor = ENFEEBLE_TINT

    damageMin = 0
    damageMax = 0
    damageType = 'magic'

    weakenAmount = 2
    weakenTurns = 3

    // --- Progression ladder ----------------------------------------------------
    //   L1 : -2 attack, 3 turns
    //   L2 : +1 weaken                                                     [boost]
    //   L3 : augment — Crippling (+weaken) | Lasting (+turns) | Far (+range)
    //   L4 : a trait slot — Reaching | Quickened | Efficient
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.weakenAmount += 1 },
    }

    augments = {
        crippling: { label: 'Crippling', apply: a => { a.weakenAmount += 2 } },
        lasting:   { label: 'Lasting',   apply: a => { a.weakenTurns += 3 } },
        far:       { label: 'Far',       apply: a => { a.range += 3 } },
    }

    traits = {
        reaching:  reaching(2),
        quickened: quickened(1),
        efficient: efficient({ ap: 1 }),
    }

    activate(hero, target) {
        afflict(this, hero, target.entity, {
            castType: 'arcane',
            projectile: { attackTile: ENFEEBLE_PROJECTILE_TILE, tint: this.fxColor },
            onImpact: (v, result) => {
                if (result.killed || !v.sprite) return
                v.addTag(weaken, this.weakenTurns, this.weakenAmount)
                gameLog.log(`${hero.name} enfeebles ${v.name}.`)
            },
        })
    }
}
