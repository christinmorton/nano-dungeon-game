import Ability from './Ability.js'
import regen from '../../tags/regen.js'

// Dwarf W — self-buff. Applies the regen tag (2 HP per turn for 4
// turns). Re-applying while active is a no-op (Taggable dedupes by
// name) until the current regen expires.

export default class SecondWind extends Ability {
    name = 'Second Wind'
    icon = 31
    description = 'Heal 2 HP per turn for 4 turns. 1 AP, cd 8.'
    cost = { ap: 1, mp: 0 }
    cooldown = 8
    range = 0
    target = 'self'

    activate(hero, target) {
        hero.addTag(regen)
    }
}
