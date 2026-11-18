import Ability from './Ability.js'
import sense from '../../tags/sense.js'

// Ranger S — self-buff. Apply Sense for 5 turns: every enemy on the floor
// renders regardless of fog of war.
//
// Nothing here reaches into FogOfWar. `FogOfWar.syncEntities` already checks
// `dungeon.player._tags.includes("Sense")` each refresh and bypasses its usual
// line-of-sight gate while the tag is present — that check came over with the
// port and has been inert since day one, waiting for something to set the tag.
// This is the something. Scope doc §10.6.
//
// It is the Ranger's scouting identity made real: the class has the DEX and SPD
// to pick its fights, and until now no way to see what the fights were.

export default class Sense extends Ability {
    name = 'Sense'
    icon = 10
    description = 'Reveal every enemy on the floor for 5 turns, through walls and fog. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'

    activate(hero) {
        hero.addTag(sense)
    }
}
