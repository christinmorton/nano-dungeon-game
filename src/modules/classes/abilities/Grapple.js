import Ability from './Ability.js'
import { displace } from '../../abilities/patterns.js'
import { reaching } from '../../abilities/traitDefs.js'

// Grapple — a utility control tool: hook an enemy and drag it toward you (the
// displace 'pull' mode), up to `range` tiles, so a melee bruiser can yank a kiting
// ranged attacker into reach. The pull stops at the caster / an obstacle.
// Unslotted.
export default class Grapple extends Ability {
    name = 'Grapple'
    icon = 31
    description = 'Hook an enemy and drag it toward you (up to 3 tiles). 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 3
    target = 'pickEnemy'

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.range += 1 },
    }

    augments = {
        longHook:  reaching(2),
        quickened: { label: 'Quickened', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        reaching: reaching(2),
    }

    activate(hero, target) {
        // distance = range so a target anywhere in range is dragged to adjacency.
        displace(this, hero, target.entity, { mode: 'pull', distance: this.range })
    }
}
