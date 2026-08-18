import Passive from './Passive.js'
import keenEdge from '../../tags/keenEdge.js'

// Passive pool ability — Keen Edge: a permanent +2 attackPower while
// equipped. Bridge-to-tags: wraps the keenEdge trait tag. Unslotted.

export default class KeenEdge extends Passive {
    name = 'Keen Edge'
    icon = 31
    description = 'Passive: +2 attack power.'
    tags = [keenEdge]
}
