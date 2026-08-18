import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { shieldSelf, reactive } from '../../abilities/patterns.js'
import corruption from '../../tags/corruption.js'
import { bump, quickened } from '../../abilities/traitDefs.js'

// Void defense — wrap yourself in a VOID SHROUD: a drain-shield. Raise an absorb
// pool (scaled by magicPower) that HEALS you for a fraction of everything it
// soaks (the new leech-shield mechanic, damage.js `_shieldDrainRatio`) — so the
// dark caster sustains by being attacked. The Spiteful augment also Corrupts any
// melee attacker (reactive Counter rider). The Void counterpart to Cinder/Rime/
// Caustic wards. Library/unslotted (Void).

const VOID_TINT = 0x7a2fa0

export default class VoidShroud extends Ability {
    name = 'Void Shroud'
    icon = 31
    description = 'Shroud yourself in void: an absorb shield that heals you for 40% of what it soaks. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    fxColor = VOID_TINT

    shieldBase = 8             // + magicPower at cast = the absorb pool
    drainRatio = 0.4           // heal this fraction of absorbed damage
    spiteful = false           // augment: also Corrupt melee attackers
    wardTurns = 3              // how long the spiteful retaliation stays armed
    damageMin = 0              // Spiteful uses the Corruption status, not direct dmg
    damageMax = 0
    damageType = 'magic'
    appliesStatus = corruption // reactive grafts Corruption onto attackers (Spiteful)

    // --- Progression ladder ----------------------------------------------------
    //   L1 : shield 8+magic · leech 40%
    //   L2 : +4 shield                                                     [boost]
    //   L3 : augment — Greater Shroud (+shield) | Vampiric (leech 65%) | Spiteful (Corrupt attackers)
    //   L4 : a trait slot — Reinforced (+shield) | Ravenous (+leech) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.shieldBase += 4 },
    }

    augments = {
        greater:  { label: 'Greater Shroud', apply: a => { a.shieldBase += 6 } },
        vampiric: { label: 'Vampiric',       apply: a => { a.drainRatio = 0.65 } },
        spiteful: { label: 'Spiteful',       apply: a => { a.spiteful = true } },
    }

    traits = {
        reinforced: bump('Reinforced', 'shieldBase', 5),
        ravenous:   { label: 'Ravenous', apply: a => { a.drainRatio += 0.15 } },
        quickened:  quickened(1),
    }

    activate(hero) {
        const amount = this.shieldBase + hero.stat('magicPower')
        shieldSelf(hero, amount, { castType: 'arcane', tint: this.fxColor })
        hero._shieldDrainRatio = this.drainRatio   // leech-shield (cleared when the Shield breaks)
        if (this.spiteful) reactive(this, hero, { turns: this.wardTurns, castType: null })
        gameLog.log(`${hero.name} is shrouded in void (${amount} shield, leech ${Math.round(this.drainRatio * 100)}%).`)
        return true
    }
}
