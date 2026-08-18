import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import evasion from '../../tags/evasion.js'
import { bump, quickened } from '../../abilities/traitDefs.js'

// Blur — the CASTER's evasion: a brief arcane shimmer that makes the wizard hard
// to hit (the shared Evasion dodge-spike tag, reflavored). Demonstrates "same
// primitive, different class flavor" — a stronger spike than the Elf's Evasion but
// a shorter flicker (a blink-out, not a sustained weave). Gives the Wizard a
// non-Barrier, non-Blink defensive option. Self-buff. Unslotted.
export default class Blur extends Ability {
    name = 'Blur'
    icon = 31
    description = 'Blur your form: become briefly hard to hit (a strong, short dodge spike). 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 0
    target = 'self'

    fxColor = 0xb887ff          // arcane violet shimmer

    dodgeAmount = 11           // strong spike — pushes a caster toward the dodge cap
    dodgeTurns = 2             // but brief: a flicker, not a stance

    // --- Progression ladder -----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.dodgeTurns += 1 },
    }

    augments = {
        lingering: { label: 'Lingering', apply: a => { a.dodgeTurns += 1 } },
        flicker:   quickened(2),
    }

    traits = {
        phantasmal: bump('Phantasmal', 'dodgeAmount', 3),
    }

    activate(hero, target) {
        hero.addTag(evasion, this.dodgeTurns, this.dodgeAmount)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name}'s form blurs.`)
    }
}
