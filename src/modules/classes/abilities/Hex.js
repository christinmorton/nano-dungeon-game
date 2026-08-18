import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { afflict } from '../../abilities/patterns.js'
import cursed from '../../tags/cursed.js'
import { reaching, quickened } from '../../abilities/traitDefs.js'

// Void tree — a hex that curses a target with no direct damage; the Cursed status
// carries the harm (a dark DoT). Gave Cursed its first applier. Converted onto the
// afflict archetype (a zero-damage bolt); Cursed is applied explicitly in onImpact
// so the ladder can scale its per-turn bite and duration. PLANNED RENAME → "Curse"
// (de-WoW §1.6); kept until the user confirms. Library/unslotted (Void).

const HEX_TINT = 0x8822cc
const HEX_PROJECTILE_TILE = 567

export default class Hex extends Ability {
    name = 'Hex'
    icon = 31
    description = 'Curse an enemy (range 5) with no direct damage — applies Cursed (1/turn for 5 turns). 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'pickEnemy'
    fxColor = HEX_TINT

    damageMin = 0
    damageMax = 0
    damageType = 'magic'

    curseDamage = 1
    curseTurns = 5

    // --- Progression ladder ----------------------------------------------------
    //   L1 : Cursed 1/turn x5
    //   L2 : +1 curse/turn                                                 [boost]
    //   L3 : augment — Virulent (+curse) | Lingering (+turns) | Far Hex (+range)
    //   L4 : a trait slot — Reaching | Quickened | Withering (+curse)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.curseDamage += 1 },
    }

    augments = {
        virulent:  { label: 'Virulent',  apply: a => { a.curseDamage += 2 } },
        lingering: { label: 'Lingering', apply: a => { a.curseTurns += 3 } },
        farHex:    { label: 'Far Hex',   apply: a => { a.range += 3 } },
    }

    traits = {
        reaching:  reaching(2),
        quickened: quickened(1),
        withering: { label: 'Withering', apply: a => { a.curseDamage += 1 } },
    }

    activate(hero, target) {
        afflict(this, hero, target.entity, {
            castType: 'arcane',
            projectile: { attackTile: HEX_PROJECTILE_TILE, tint: this.fxColor },
            onImpact: (v, result) => {
                if (result.killed || !v.sprite) return
                v.addTag(cursed, this.curseDamage, this.curseTurns)
                gameLog.log(`${hero.name} hexes ${v.name}.`)
            },
        })
    }
}
