import Ability from './Ability.js'
import bulwark from '../../tags/bulwark.js'

// Warrior E — self-buff. Applies the bulwark tag (3 turns of +50 to
// the `block` stat, which pins blockChance to the existing 0.5 cap).
// Re-applying while active is a no-op until the current bulwark
// expires (Taggable dedupes by name).

export default class Bulwark extends Ability {
    name = 'Bulwark'
    icon = 2
    description = 'Self-buff: pins block chance to 50% for 3 turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'

    activate(hero, target) {
        hero.addTag(bulwark)
    }
}
