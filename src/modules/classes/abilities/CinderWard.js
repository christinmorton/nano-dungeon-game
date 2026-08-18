import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { shieldSelf, reactive } from '../../abilities/patterns.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Fire defense — wreathe yourself in cinders: a two-part self-ward. Raise a fire
// SHIELD (an absorb pool scaled by magicPower) AND arm a retaliation that BURNS any
// melee attacker that strikes you (the Counter tag, fire-typed). Composes
// shieldSelf (absorb) + reactive (thorns). The Fire tree's defensive option.
// Library/unslotted.

const FIRE_TINT = 0xff7733

export default class CinderWard extends Ability {
    name = 'Cinder Ward'
    icon = 31
    description = 'Wreathe yourself in cinders: gain a fire shield (absorb) AND burn melee attackers for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    fxColor = FIRE_TINT

    shieldBase = 6              // + magicPower at cast = the absorb pool
    wardTurns = 3              // how long the burn-retaliation stays armed
    damageMin = 3              // fire damage to each attacker (reactive reads these)
    damageMax = 5
    damageType = 'magic'

    // --- Progression ladder ----------------------------------------------------
    //   L1 : shield 6+magic, burn 3..5, 3 turns
    //   L2 : +3 shield                                                     [boost]
    //   L3 : augment — Greater Ward (+shield) | Scorching Ward (+burn) | Lasting Ward (+turns)
    //   L4 : a trait slot — Reinforced (+shield) | Hotter Embers (+burn) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.shieldBase += 3 },
    }

    augments = {
        greater:   { label: 'Greater Ward', apply: a => { a.shieldBase += 6 } },
        scorching: { label: 'Scorching Ward', apply: a => { a.damageMin += 3; a.damageMax += 4 } },
        lasting:   { label: 'Lasting Ward', apply: a => { a.wardTurns += 2 } },
    }

    traits = {
        reinforced: bump('Reinforced', 'shieldBase', 4),
        hotter:     { label: 'Hotter Embers', apply: a => { a.damageMin += 2; a.damageMax += 2 } },
        quickened:  quickened(1),
    }

    activate(hero) {
        const amount = this.shieldBase + hero.stat('magicPower')
        shieldSelf(hero, amount, { castType: 'fire', tint: this.fxColor })
        reactive(this, hero, { turns: this.wardTurns, castType: null })   // burn attackers (reads damageMin/Max)
        gameLog.log(`${hero.name} is wreathed in cinders.`)
        return true
    }
}
