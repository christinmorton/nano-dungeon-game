import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import warded from '../../tags/warded.js'
import { buffAura } from '../../abilities/patterns.js'
import { enlarge, quickened } from '../../abilities/traitDefs.js'

// Warding Banner — a party MAGIC defense: ward yourself AND nearby allies against
// spells (the Warded tag, +barrier) via the buffAura pattern. The group cousin of
// Spell Ward — a martial support tool for shielding a line from a caster. Self-
// centered radius. Unslotted.
export default class WardingBanner extends Ability {
    name = 'Warding Banner'
    icon = 31
    description = 'Plant a warding banner: +magic resist to you and nearby allies for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    radius = 2
    appliesStatus = warded   // buffAura applies this to each ally in radius

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1 },
    }

    augments = {
        wide:      enlarge(1),
        quickened: quickened(2),
    }

    traits = {
        broad: enlarge(1),
    }

    activate(hero, target) {
        const count = buffAura(this, hero, {})
        gameLog.log(count
            ? `${hero.name}'s warding banner shields ${count} against magic.`
            : `${hero.name} plants a warding banner.`)
    }
}
