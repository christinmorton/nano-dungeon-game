import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import guarded from '../../tags/guarded.js'
import { bump } from '../../abilities/traitDefs.js'

// Brace — a steady all-round defensive stance: +armor AND +magic resist (the
// Guarded tag) for a few turns. Distinct from Bulwark (block) and Spell Ward
// (magic only): flat reduction against both damage schools. Self-buff. Unslotted.
export default class Brace extends Ability {
    name = 'Brace'
    icon = 31
    description = 'Brace yourself: +armor and magic resist for a few turns — a steady all-round guard. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 0
    target = 'self'

    guardAmount = 8
    guardTurns = 3

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.guardAmount += 3 },
    }

    augments = {
        steadfast: { label: 'Steadfast', apply: a => { a.guardTurns += 2 } },
        ironclad:  bump('Ironclad', 'guardAmount', 5),
    }

    traits = {
        resolute: bump('Resolute', 'guardAmount', 4),
    }

    activate(hero, target) {
        hero.addTag(guarded, this.guardTurns, this.guardAmount)
        gameLog.log(`${hero.name} braces for impact.`)
    }
}
