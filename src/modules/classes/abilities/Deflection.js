import Passive from './Passive.js'
import deflection from '../../tags/deflection.js'

// Deflection — passive +block (a trained guard that turns physical blows aside).
// The block-stat passive: completes the defensive passive trio alongside Toughness
// (+armor) and Second Skin (+dodge). The always-on, weaker cousin of the Parry
// active. Unslotted.
export default class Deflection extends Passive {
    name = 'Deflection'
    icon = 31
    description = 'Passive: +2 block (chance to turn aside physical attacks).'
    tags = [deflection]
}
