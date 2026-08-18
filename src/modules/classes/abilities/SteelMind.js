import Passive from './Passive.js'
import steelMind from '../../tags/steelMind.js'

// Steel Mind — passive MAGIC resistance (+barrier). The magic-defense cousin of
// Toughness (+armor): a disciplined martial mind shrugs off spells. Wraps the
// permanent steelMind trait tag. Unslotted.
export default class SteelMind extends Passive {
    name = 'Steel Mind'
    icon = 31
    description = 'Passive: +5 magic resist.'
    tags = [steelMind]
}
