import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { afflict } from '../../abilities/patterns.js'
import { reaching, quickened } from '../../abilities/traitDefs.js'
import { applyCorrosion } from '../../tags/corrosion.js'

// Decay debuff — spit a glob of corrosive bile that eats a target's armor. No
// direct damage; applies Corrosion, the tree's signature MELTING debuff: -armor
// that deepens every round (see tags/corrosion.js), softening the foe for your
// DoTs and your party's blows. The setup spell of the attrition kit. A zero-
// damage bolt = the afflict archetype. Library/unslotted.
//
// NOTE: interim for the durability system — true corrosion would also chew the
// equipped armor's own integrity. Ships now as the deepening stat-debuff.

const DECAY_TINT = 0x9bbf2f
const CORRODE_PROJECTILE_TILE = 567

export default class Corrode extends Ability {
    name = 'Corrode'
    icon = 31
    description = "Spit corrosive bile at an enemy (range 5): no damage, but applies Corrosion — armor melts -2 and deepens each turn (up to -6) for 4 turns. 1 AP, cd 5."
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 5
    target = 'pickEnemy'
    fxColor = DECAY_TINT

    damageMin = 0
    damageMax = 0
    damageType = 'magic'

    // Corrosion params (declarative for the ladder): starting shred, cap, duration.
    corrodeAmount = 2
    corrodeMax = 6
    corrodeTurns = 4

    // --- Progression ladder ----------------------------------------------------
    //   L1 : -2 armor, deepening to -6, over 4 turns
    //   L2 : +1 starting shred                                             [boost]
    //   L3 : augment — Deep Etch (+cap) | Fast Acting (+start) | Persistent (+turns)
    //   L4 : a trait slot — Reaching | Quickened | Pitting (+cap)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.corrodeAmount += 1 },
    }

    augments = {
        deep:       { label: 'Deep Etch',   apply: a => { a.corrodeMax += 3 } },
        fastActing: { label: 'Fast Acting', apply: a => { a.corrodeAmount += 2 } },
        persistent: { label: 'Persistent',  apply: a => { a.corrodeTurns += 3 } },
    }

    traits = {
        reaching:  reaching(2),
        quickened: quickened(1),
        pitting:   { label: 'Pitting', apply: a => { a.corrodeMax += 2 } },
    }

    activate(hero, target) {
        const victim = target.entity
        afflict(this, hero, victim, {
            castType: 'arcane',
            projectile: { attackTile: CORRODE_PROJECTILE_TILE, tint: this.fxColor },
            onImpact: (v, result) => {
                if (result.killed) return
                applyCorrosion(v, this.corrodeTurns, this.corrodeAmount, this.corrodeMax)
                gameLog.log(`${hero.name}'s Corrode begins eating ${v.name}'s armor.`)
            },
        })
    }
}
