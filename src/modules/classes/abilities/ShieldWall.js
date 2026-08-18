import Ability from './Ability.js'
import { shieldSelf } from '../../abilities/patterns.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Shield Wall — an active damage-soak: gain a depletable absorb pool (the Shield
// verb, spent before HP) that eats the next chunk of damage of ANY type. The
// tank's panic button — the active cousin of Bulwark's flat block. Unslotted.
export default class ShieldWall extends Ability {
    name = 'Shield Wall'
    icon = 31
    description = 'Brace behind your guard: gain a shield that absorbs the next burst of damage. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'

    shieldAmount = 25

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.shieldAmount += 10 },
    }

    augments = {
        reinforced: bump('Reinforced', 'shieldAmount', 15),
        quickened:  quickened(2),
    }

    traits = {
        bulwark: bump('Bulwark', 'shieldAmount', 10),
    }

    activate(hero, target) {
        shieldSelf(hero, this.shieldAmount)
    }
}
