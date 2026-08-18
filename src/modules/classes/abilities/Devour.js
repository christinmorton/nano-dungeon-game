import Passive from './Passive.js'
import devour from '../../tags/devour.js'

// Devour — the Demonic affinity's passive (granted with the affinity via
// affinities.js `passive`). Demons hunger: the attuned entity heals for a quarter
// of the damage it deals. Entity-agnostic like every Passive, so a Demonic-attuned
// champion enemy carries it too.
export default class Devour extends Passive {
    name = 'Devour'
    icon = 0
    description = 'Passive (Demonic): heal for a quarter of the damage you deal.'
    tags = [devour]
}
