import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { reactive } from '../../abilities/patterns.js'

// Counterstroke — a riposte stance: for a few turns, strike back at melee
// attackers that land a non-fatal hit (the Counter tag + Combat.attack hook, via
// the reactive pattern). No damage fields, so the counter hits for the hero's
// live attackPower. `charges` caps how many ripostes; the duration is the window.
// Unslotted.
export default class Counterstroke extends Ability {
    name = 'Counterstroke'
    icon = 31
    description = 'Take a riposte stance: strike back at the next few melee attackers for a full hit. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 0
    target = 'self'

    counterTurns = 3
    counterCharges = 2

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.counterCharges += 1 },
    }

    augments = {
        vigilant: { label: 'Vigilant', apply: a => { a.counterCharges += 2 } },
        lasting:  { label: 'Lasting', apply: a => { a.counterTurns += 2 } },
    }

    traits = {
        relentless: { label: 'Relentless', apply: a => { a.counterCharges += 1 } },
    }

    activate(hero, target) {
        reactive(this, hero, { turns: this.counterTurns, charges: this.counterCharges })
        gameLog.log(`${hero.name} takes a counter stance.`)
    }
}
