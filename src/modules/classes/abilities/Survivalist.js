import Passive from './Passive.js'
import survivalist from '../../tags/survivalist.js'

// Passive pool ability — Survivalist: regenerate HP each round while OUT of combat,
// topping off between fights without resting. Bridge-to-tags: wraps the survivalist
// trait tag (refresh + inCombat gate). The Elf wilderness-sustain passive. Unslotted.

export default class Survivalist extends Passive {
    name = 'Survivalist'
    icon = 31
    description = 'Passive: regenerate health between fights (when out of combat).'
    tags = [survivalist]
}
