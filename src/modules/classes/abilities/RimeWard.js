import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { shieldSelf, reactive } from '../../abilities/patterns.js'
import slow from '../../tags/slow.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Ice defense — sheathe yourself in rime: a two-part self-ward. Raise an ice
// SHIELD (absorb pool scaled by magicPower) AND arm a retaliation that chills any
// melee attacker — cold damage + Slow (the Counter tag's new status rider). The
// control cousin of Cinder Ward (which burns); composes shieldSelf + reactive.
// Library/unslotted.

const ICE_TINT = 0x6ab8ff

export default class RimeWard extends Ability {
    name = 'Rime Ward'
    icon = 31
    description = 'Sheathe yourself in rime: gain an ice shield (absorb) AND chill melee attackers (cold + Slow) for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    fxColor = ICE_TINT

    shieldBase = 6              // + magicPower at cast = the absorb pool
    wardTurns = 3
    damageMin = 2              // cold retaliation per attacker (reactive reads these)
    damageMax = 4
    damageType = 'magic'
    appliesStatus = slow       // reactive applies this to each countered attacker

    // --- Progression ladder ----------------------------------------------------
    //   L1 : shield 6+magic, chill 2..4 + Slow, 3 turns
    //   L2 : +3 shield                                                     [boost]
    //   L3 : augment — Greater Ward (+shield) | Biting Ward (+cold) | Lasting Ward (+turns)
    //   L4 : a trait slot — Reinforced (+shield) | Quickened | Lasting (+turns)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.shieldBase += 3 },
    }

    augments = {
        greater: { label: 'Greater Ward', apply: a => { a.shieldBase += 6 } },
        biting:  { label: 'Biting Ward', apply: a => { a.damageMin += 2; a.damageMax += 3 } },
        lasting: { label: 'Lasting Ward', apply: a => { a.wardTurns += 2 } },
    }

    traits = {
        reinforced: bump('Reinforced', 'shieldBase', 4),
        quickened:  quickened(1),
        lasting:    bump('Lasting', 'wardTurns', 2),
    }

    activate(hero) {
        const amount = this.shieldBase + hero.stat('magicPower')
        shieldSelf(hero, amount, { castType: 'frost', tint: this.fxColor })
        reactive(this, hero, { turns: this.wardTurns, castType: null })   // chill attackers (cold + Slow)
        gameLog.log(`${hero.name} sheathes in rime.`)
        return true
    }
}
