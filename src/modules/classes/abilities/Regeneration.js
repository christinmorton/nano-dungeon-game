import Passive from './Passive.js'
import regeneration from '../../tags/regeneration.js'

// Passive pool ability — Regeneration: heal 1 HP every turn while equipped.
// Bridge-to-tags: wraps the regeneration trait tag. Unslotted.

export default class Regeneration extends Passive {
    name = 'Regeneration'
    icon = 31
    description = 'Passive: heal 1 HP each turn.'
    tags = [regeneration]
}
