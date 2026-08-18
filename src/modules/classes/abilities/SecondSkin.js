import Passive from './Passive.js'
import secondSkin from '../../tags/secondSkin.js'

// Second Skin — passive +armor and a little +dodge (a tough, agile hide). A
// library defensive passive, distinct from Toughness (pure armor) by the dodge.
// Wraps the permanent secondSkin trait tag. Unslotted.
export default class SecondSkin extends Passive {
    name = 'Second Skin'
    icon = 31
    description = 'Passive: +3 armor and +1 dodge.'
    tags = [secondSkin]
}
