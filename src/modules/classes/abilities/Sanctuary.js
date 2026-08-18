import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import guarded from '../../tags/guarded.js'
import { buffAura } from '../../abilities/patterns.js'
import { enlarge, quickened } from '../../abilities/traitDefs.js'

// Sanctuary — the Cleric's protective aura: shelter yourself AND nearby allies with
// Guarded (+armor AND +magic resist) via the buffAura pattern. The holy all-round
// upgrade of the martial Warding Banner (which wards magic only) — a party defense
// for weathering a burst. Self-centered radius. Unslotted — the holy support slot.
export default class Sanctuary extends Ability {
    name = 'Sanctuary'
    icon = 31
    description = 'Call a sanctuary: +armor and magic resist to you and nearby allies for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    radius = 2
    appliesStatus = guarded   // buffAura applies this (defaults: +6 armor & magic resist, 3 turns)

    // --- Progression ladder -----------------------------------------------------
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
        hallowed: enlarge(1),
    }

    activate(hero, target) {
        const count = buffAura(this, hero, {})
        gameLog.log(count
            ? `${hero.name} calls a sanctuary, sheltering ${count}.`
            : `${hero.name} calls a sanctuary.`)
    }
}
