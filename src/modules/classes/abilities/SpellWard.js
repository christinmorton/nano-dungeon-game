import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import warded from '../../tags/warded.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Spell Ward — a MARTIAL magic defense: raise a warding guard for +magic resist
// (the `barrier` stat, via the Warded tag) for a few turns. Gives a melee class a
// way to shrug off spells without leaning on its (low) Magic stat — the ward is a
// flat value, not magicPower-scaled. Self-buff. Unslotted (library).
export default class SpellWard extends Ability {
    name = 'Spell Ward'
    icon = 31
    description = 'Raise a warding guard: +magic resist for a few turns. A martial defense against spells. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 0
    target = 'self'

    wardAmount = 10
    wardTurns = 4

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.wardAmount += 4 },
    }

    augments = {
        steadfast: { label: 'Steadfast', apply: a => { a.wardTurns += 2 } },
        fortified: bump('Fortified', 'wardAmount', 6),
        quickened: quickened(2),
    }

    traits = {
        warding: bump('Warding', 'wardAmount', 5),
        lasting: { label: 'Lasting', apply: a => { a.wardTurns += 2 } },
    }

    activate(hero, target) {
        hero.addTag(warded, this.wardTurns, this.wardAmount)
        gameLog.log(`${hero.name} raises a ward against magic.`)
    }
}
