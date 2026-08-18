import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import aim from '../../tags/aim.js'
import { playCast } from '../../Animations.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Elf / skirmisher — the precision buff. Steady your aim to greatly raise crit
// chance for a few turns (the Aim tag; Combat rolls attacker crit from
// stat('critChance')). The cheap "line up the shot" steroid — pairs with
// Hunter's Focus (raw power). Self-buff, library/unslotted.

export default class TakeAim extends Ability {
    name = 'Take Aim'
    icon = 31
    description = 'Steady your aim: greatly raise crit chance for a few turns. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 0
    target = 'self'

    fxColor = 0xffe08a          // warm focus-gold

    aimTurns = 3
    aimBonus = 0.25             // +25% crit chance while held

    // --- Progression ladder ----------------------------------------------------
    //   L1 : +25% crit, 3 turns
    //   L2 : +30% crit                                                    [boost]
    //   L3 : augment — Steady (+3 turns) | Sharpshooter (+20% crit) | Snap Aim (cd -2)
    //   L4 : a trait slot — Lasting (+turns) | Keen (+crit) | Quickened (cd -1)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.aimBonus += 0.05 },
    }

    augments = {
        steady:       { label: 'Steady', apply: a => { a.aimTurns += 3 } },
        sharpshooter: { label: 'Sharpshooter', apply: a => { a.aimBonus += 0.20 } },
        snapAim:      { label: 'Snap Aim', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        lasting:   bump('Lasting', 'aimTurns', 2),
        keen:      bump('Keen', 'aimBonus', 0.10),
        quickened: quickened(1),
    }

    activate(hero) {
        hero.addTag(aim, this.aimTurns, this.aimBonus)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name} takes careful aim.`)
        return true
    }
}
