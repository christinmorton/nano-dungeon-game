import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import galvanized from '../../tags/galvanized.js'
import { playCast } from '../../Animations.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Storm buff — galvanize your nerves to a hair-trigger: +dodge AND +crit for a few
// turns (lightning reflexes — an offense/defense combo, the Galvanized tag). The
// tree's self-empower; pop it before diving into a burst. Self-buff, library.

const STORM_TINT = 0x66aaff

export default class Galvanize extends Ability {
    name = 'Galvanize'
    icon = 31
    description = 'Galvanize your reflexes: +dodge and +crit chance for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    fxColor = STORM_TINT

    galvTurns = 3
    galvDodge = 6              // dodge points (~+3%/pt)
    galvCrit = 0.15           // +15% crit chance

    // --- Progression ladder ----------------------------------------------------
    //   L1 : +6 dodge, +15% crit, 3 turns
    //   L2 : +2 dodge                                                      [boost]
    //   L3 : augment — Quickstep (+dodge) | Killing Edge (+crit) | Lasting Charge (+turns)
    //   L4 : a trait slot — Evasive (+dodge) | Lasting (+turns) | Quickened (cd -1)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.galvDodge += 2 },
    }

    augments = {
        quickstep: { label: 'Quickstep', apply: a => { a.galvDodge += 4 } },
        killing:   { label: 'Killing Edge', apply: a => { a.galvCrit += 0.15 } },
        lasting:   { label: 'Lasting Charge', apply: a => { a.galvTurns += 2 } },
    }

    traits = {
        evasive:   bump('Evasive', 'galvDodge', 3),
        lasting:   bump('Lasting', 'galvTurns', 2),
        quickened: quickened(1),
    }

    activate(hero) {
        hero.addTag(galvanized, this.galvTurns, this.galvDodge, this.galvCrit)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name} galvanizes.`)
        return true
    }
}
