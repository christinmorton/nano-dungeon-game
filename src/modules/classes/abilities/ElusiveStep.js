import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import evasion from '../../tags/evasion.js'
import { reactive } from '../../abilities/patterns.js'

// Elusive Step — the skirmisher's COMBO defense: dodge AND punish. Spikes `dodge`
// (the Evasion tag) while arming a riposte (the Counter tag, via reactive), so the
// Elf both slips attacks and cuts back at those that connect. The worked example of
// a two-primitive defensive ability (avoidance + counter) — the dodge half is a
// touch weaker than pure Evasion to pay for the counter. Self-buff. Unslotted —
// the Elf's offensive-defense.
export default class ElusiveStep extends Ability {
    name = 'Elusive Step'
    icon = 31
    description = 'Step elusively: raised dodge AND a riposte that cuts back at attackers, for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'

    fxColor = 0xc8f0ff          // bright blade-flash

    dodgeAmount = 6            // weaker dodge than Evasion — the counter is the other half
    danceTurns = 3
    counterCharges = 2

    // --- Progression ladder -----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.counterCharges += 1 },
    }

    augments = {
        whirling: { label: 'Whirling', apply: a => { a.dodgeAmount += 3 } },
        relentless: { label: 'Relentless', apply: a => { a.counterCharges += 2 } },
    }

    traits = {
        flowing: { label: 'Flowing', apply: a => { a.danceTurns += 2 } },
    }

    activate(hero, target) {
        hero.addTag(evasion, this.danceTurns, this.dodgeAmount)
        reactive(this, hero, { turns: this.danceTurns, charges: this.counterCharges })
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name} slips into an elusive step.`)
    }
}
