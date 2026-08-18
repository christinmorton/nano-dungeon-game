import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { reactive } from '../../abilities/patterns.js'

// Reflect — a defensive stance that BOUNCES part of every hit back at the
// attacker for a few turns. Built on the Counter system's new reflect-fraction
// mode (reactive { reflect }): instead of a flat riposte (Counterstroke), it
// returns `reflectFraction` of the damage just taken, as magic (a retaliatory
// shimmer) — pairs with the martial magic-defense branch. Unlimited triggers for
// the duration. Unslotted.
export default class Reflect extends Ability {
    name = 'Reflect'
    icon = 31
    description = 'Take a reflecting stance: bounce part of every hit you take back at the attacker for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    damageType = 'magic'

    reflectFraction = 0.4
    reflectTurns = 3

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.reflectFraction += 0.1 },
    }

    augments = {
        mirror:  { label: 'Mirror', apply: a => { a.reflectFraction += 0.2 } },
        lasting: { label: 'Lasting', apply: a => { a.reflectTurns += 2 } },
    }

    traits = {
        prism: { label: 'Prism', apply: a => { a.reflectFraction += 0.1 } },
    }

    activate(hero, target) {
        reactive(this, hero, { turns: this.reflectTurns, reflect: this.reflectFraction, charges: null })
        gameLog.log(`${hero.name} takes a reflecting stance.`)
    }
}
