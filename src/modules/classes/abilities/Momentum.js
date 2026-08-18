import Passive from './Passive.js'
import momentum from '../../tags/momentum.js'

// Momentum — triggered passive: builds +attack each round you stay in combat (up
// to a cap), resets when you disengage. The "stay aggressive" passive — rewards
// sustained fights. Reads the hero's combat-recency signal (BaseHero.inCombat).
// Unslotted.
export default class Momentum extends Passive {
    name = 'Momentum'
    icon = 31
    description = 'Passive: gain +2 attack each round in combat (up to +8); resets when you disengage.'
    tags = [momentum]
}
