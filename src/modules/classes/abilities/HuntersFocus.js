import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import focus from '../../tags/focus.js'
import { playCast } from '../../Animations.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Elf / skirmisher — the power buff. Sink into the hunt: +attackPower for a few
// turns (the Focus tag; attackPower feeds hero.attack(), so every shot hits
// harder). The big damage steroid — stacks with Take Aim (crit) for a precision +
// power burst. Self-buff, library/unslotted.

export default class HuntersFocus extends Ability {
    name = "Hunter's Focus"
    icon = 31
    description = 'Sink into the hunt: raise attack power for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'

    fxColor = 0xffb347          // burnt-orange concentration

    focusTurns = 4
    focusBonus = 4              // +attackPower while held

    // --- Progression ladder ----------------------------------------------------
    //   L1 : +4 attack, 4 turns
    //   L2 : +5 attack                                                    [boost]
    //   L3 : augment — Deep Focus (+3 turns) | Killing Focus (+4 attack) | Rapid Focus (cd -2)
    //   L4 : a trait slot — Lasting (+turns) | Mighty (+attack) | Quickened (cd -1)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.focusBonus += 1 },
    }

    augments = {
        deep:    { label: 'Deep Focus', apply: a => { a.focusTurns += 3 } },
        killing: { label: 'Killing Focus', apply: a => { a.focusBonus += 4 } },
        rapid:   { label: 'Rapid Focus', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        lasting:   bump('Lasting', 'focusTurns', 2),
        mighty:    bump('Mighty', 'focusBonus', 3),
        quickened: quickened(1),
    }

    activate(hero) {
        hero.addTag(focus, this.focusTurns, this.focusBonus)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name} sinks into focus.`)
        return true
    }
}
