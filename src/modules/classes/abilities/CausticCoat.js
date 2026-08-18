import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { shieldSelf, reactive } from '../../abilities/patterns.js'
import { quickened, bump } from '../../abilities/traitDefs.js'
import poison from '../../tags/poison.js'

// Decay defense — slick yourself in caustic slime: a two-part self-ward. Raise a
// corrosive SHIELD (an absorb pool scaled by magicPower) AND arm a retaliation
// that splashes any melee attacker for a little acid AND leaves them Poisoned
// (the Counter status rider). The attrition caster's defensive option — it turns
// every incoming blow into more DoT, doubling down on the tree's identity.
// Composes shieldSelf (absorb) + reactive (thorns + status). Library/unslotted.

const DECAY_TINT = 0x9bbf2f

export default class CausticCoat extends Ability {
    name = 'Caustic Coat'
    icon = 31
    description = 'Slick yourself in caustic slime: gain a corrosive shield (absorb) AND splash + Poison melee attackers for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    fxColor = DECAY_TINT

    shieldBase = 6              // + magicPower at cast = the absorb pool
    wardTurns = 3              // how long the caustic retaliation stays armed
    damageMin = 2              // acid splash to each attacker (reactive reads these)
    damageMax = 4
    damageType = 'magic'
    appliesStatus = poison     // reactive grafts Poison onto surviving attackers

    // --- Progression ladder ----------------------------------------------------
    //   L1 : shield 6+magic · splash 2..4 + Poison · 3 turns
    //   L2 : +3 shield                                                     [boost]
    //   L3 : augment — Thick Coat (+shield) | Acrid (+splash) | Clinging (+turns)
    //   L4 : a trait slot — Reinforced (+shield) | Caustic (+splash) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.shieldBase += 3 },
    }

    augments = {
        thick:    { label: 'Thick Coat', apply: a => { a.shieldBase += 6 } },
        acrid:    { label: 'Acrid',      apply: a => { a.damageMin += 3; a.damageMax += 4 } },
        clinging: { label: 'Clinging',   apply: a => { a.wardTurns += 2 } },
    }

    traits = {
        reinforced: bump('Reinforced', 'shieldBase', 4),
        caustic:    { label: 'Caustic', apply: a => { a.damageMin += 2; a.damageMax += 2 } },
        quickened:  quickened(1),
    }

    activate(hero) {
        const amount = this.shieldBase + hero.stat('magicPower')
        shieldSelf(hero, amount, { castType: 'arcane', tint: this.fxColor })
        reactive(this, hero, { turns: this.wardTurns, castType: null })   // splash + Poison attackers
        gameLog.log(`${hero.name} is slick with caustic slime.`)
        return true
    }
}
