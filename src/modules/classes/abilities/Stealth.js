import Ability from './Ability.js'
import invisible from '../../tags/invisible.js'

// Elf A — self-buff. Apply Invisible for 4 turns: enemies can't
// perceive the elf (Perception.canSee returns false), sprite drops
// to alpha 0.4 to telegraph the state. The next attack the elf makes
// breaks Invisible AND deals +floor(DEX/2) bonus damage (handled by
// the invisible tag's `attack` hook).

export default class Stealth extends Ability {
    name = 'Stealth'
    icon = 31
    description = 'Vanish for 4 turns; enemies cannot see you. Next attack breaks stealth with +DEX/2 bonus damage. 1 AP, cd 8.'
    cost = { ap: 1, mp: 0 }
    cooldown = 8
    range = 0
    target = 'self'

    activate(hero, target) {
        hero.addTag(invisible)
    }
}
