import Passive from './Passive.js'
import toughness from '../../tags/toughness.js'

// Passive pool ability — Toughness: a permanent +3 armor while equipped.
// Bridge-to-tags: wraps the toughness trait tag. Unslotted.

export default class Toughness extends Passive {
    name = 'Toughness'
    icon = 31
    description = 'Passive: +3 armor.'
    tags = [toughness]
}
