import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { absorb } from '../../abilities/universals.js'

// DEBUG — test consumer for the absorb verb / Shield pool (2026-06-10).
// Self-cast a damage-absorbing Shield scaled by magicPower. Provisionally on the
// Wizard A slot (swapped in for Arc Lightning) to exercise absorb; restore Arc
// Lightning when done.
//
// Distinct from Barrier: Barrier is a flat per-hit resist (both damage types,
// timed); Ward grants a depletable POOL that soaks any damage until spent. It's
// the first consumer of the `absorb` universal — later real Defense-row spells
// (Aegis, Cinder/Rime Ward, Void Shroud) compose the same verb.

export default class Ward extends Ability {
    name = 'Ward'
    icon = 31
    description = 'DEBUG: gain a Shield pool (magicPower×3) that absorbs any damage until spent. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 0
    target = 'self'

    activate(hero, target) {
        const amount = hero.stat('magicPower') * 3
        absorb(hero, amount)
        playCast(hero, { type: 'arcane' })
        gameLog.log(`${hero.name} wards itself with a ${amount}-point shield.`)
    }
}
