import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import surge from '../../tags/surge.js'
import { quickened, efficient, bump } from '../../abilities/traitDefs.js'

// Shaman spirit-tempo buff — call on quickening spirits for a burst of extra
// movement AND action each turn for a few turns, on a long cooldown (the tradeoff).
// Self-buff via the `surge` tag (Haste's MP-only cousin that also grants AP).

const SPIRIT_TINT = 0x9be7c4

export default class SpiritSurge extends Ability {
    name = 'Spirit Surge'
    icon = 31
    description = 'Call quickening spirits: +2 movement and +1 action point each turn for 3 turns. 1 AP, cd 10.'
    cost = { ap: 1, mp: 0 }
    cooldown = 10
    range = 0
    target = 'self'
    fxColor = SPIRIT_TINT

    surgeTurns = 3
    mpBonus = 2
    apBonus = 1

    // --- Progression ladder ----------------------------------------------------
    //   L1 : +2 MP / +1 AP for 3 turns, cd 10
    //   L2 : +1 turn                                                       [boost]
    //   L3 : augment — Swift (+1 MP) | Enduring (+2 turns) | Empowered (+1 AP)
    //   L4 : a trait slot — Quickened (self cd) | Efficient (free AP) | Lasting (+turns)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.surgeTurns += 1 },
    }

    augments = {
        swift:     { label: 'Swift',     apply: a => { a.mpBonus += 1 } },
        enduring:  { label: 'Enduring',  apply: a => { a.surgeTurns += 2 } },
        empowered: { label: 'Empowered', apply: a => { a.apBonus += 1 } },
    }

    traits = {
        quickened: quickened(2),
        efficient: efficient({ ap: 1 }),
        lasting:   bump('Lasting', 'surgeTurns', 1),
    }

    activate(hero, target) {
        hero.addTag(surge, this.surgeTurns, this.mpBonus, this.apBonus)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name} surges with spirit-speed (+${this.mpBonus} MP / +${this.apBonus} AP for ${this.surgeTurns} turns).`)
        return true
    }
}
