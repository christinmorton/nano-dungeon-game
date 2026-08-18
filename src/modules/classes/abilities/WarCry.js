import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import might from '../../tags/might.js'
import { buffAura } from '../../abilities/patterns.js'
import { enlarge } from '../../abilities/traitDefs.js'

// War Cry — a martial party buff: roar to empower (Might) yourself and nearby
// allies (the buffAura pattern). The martial cousin of the Cleric's single-target
// Bless — a group attack buff in a radius. Unslotted.
export default class WarCry extends Ability {
    name = 'War Cry'
    icon = 31
    description = 'Roar a war cry: empower (Might) yourself and nearby allies for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    radius = 2
    appliesStatus = might   // buffAura applies this to each ally in radius

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1 },
    }

    augments = {
        rallying:  enlarge(1),
        quickened: { label: 'Quickened', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        booming: enlarge(1),
    }

    activate(hero, target) {
        const count = buffAura(this, hero, {})
        gameLog.log(count
            ? `${hero.name} roars a war cry, emboldening ${count}.`
            : `${hero.name} roars a war cry.`)
    }
}
