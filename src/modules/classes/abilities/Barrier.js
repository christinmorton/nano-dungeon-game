import Ability from './Ability.js'
import barrier from '../../tags/barrier.js'
import { playCast } from '../../Animations.js'
import { bump, quickened, efficient } from '../../abilities/traitDefs.js'

// Arcane defense — self-buff. Raise a Barrier for a few turns: +magicPower to BOTH
// the 'armor' and 'barrier' derived stats, mitigating incoming physical AND magic
// damage (a flat per-hit resistance — distinct from Shield, the depletable absorb
// pool). VISUAL: a translucent shield BUBBLE around the caster, grey-white at base;
// the L3 "Arcane Ward" augment attunes it to an element color (the empowered /
// flavored barrier). The bubble color rides `fxColor` → the barrier tag.

const BARRIER_GREY = 0xcfd4da

export default class Barrier extends Ability {
    name = 'Barrier'
    icon = 31
    description = 'Self-buff: a shield bubble reducing physical & magic damage (by magicPower) for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'

    fxColor = BARRIER_GREY      // grey-white base; an augment attunes it to an element
    barrierTurns = 4

    // --- Progression ladder ----------------------------------------------------
    //   L1 : 4 turns, grey bubble
    //   L2 : +1 turn                                                       [boost]
    //   L3 : augment — Greater Barrier (+2 turns) | Swift Barrier (cd -2) | Arcane Ward (element-colored)
    //   L4 : a trait slot — Lasting (+turns) | Quickened (cd -1) | Efficient (0 AP)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.barrierTurns += 1 },
    }

    augments = {
        greater: { label: 'Greater Barrier', apply: a => { a.barrierTurns += 2 } },
        swift:   { label: 'Swift Barrier', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
        attuned: { label: 'Arcane Ward', apply: a => { a.fxColor = 0xc084fc } },   // violet element-flavored bubble
    }

    traits = {
        lasting:   bump('Lasting', 'barrierTurns', 2),
        quickened: quickened(1),
        efficient: efficient({ ap: 1 }),
    }

    activate(hero) {
        hero.addTag(barrier, this.barrierTurns, null, this.fxColor)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        return true
    }
}
