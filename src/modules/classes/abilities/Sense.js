import Ability from './Ability.js'
import sense from '../../tags/sense.js'

// Elf S — self-buff. Apply Sense for 5 turns: all enemies on the
// floor render regardless of fog-of-war. FogOfWar.syncEntities checks
// the hero's tags directly each frame and bypasses its usual LoS gate
// while the tag is active.

export default class Sense extends Ability {
    name = 'Sense'
    icon = 31
    description = 'Reveal every enemy on the floor for 5 turns, regardless of fog-of-war. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'

    activate(hero, target) {
        hero.addTag(sense)
    }
}
