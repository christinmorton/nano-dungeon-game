import Passive from './Passive.js'
import thorns from '../../tags/thorns.js'

// Thorns — triggered passive: reflect a fraction of melee damage taken back at the
// attacker (the onDamaged hook). The always-on retaliation, distinct from the
// active Counterstroke/Reflect (it uses a separate hook, not the Counter tag).
// Unslotted.
export default class Thorns extends Passive {
    name = 'Thorns'
    icon = 31
    description = 'Passive: reflect 30% of melee damage taken back at the attacker.'
    tags = [thorns]
}
