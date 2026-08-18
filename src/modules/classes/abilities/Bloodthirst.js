import Passive from './Passive.js'
import bloodthirst from '../../tags/bloodthirst.js'

// Bloodthirst — triggered passive: heal on kill (the onKill hook). The martial
// sustain passive, distinct from the always-on regen passives — its payoff is
// aggression. Unslotted.
export default class Bloodthirst extends Passive {
    name = 'Bloodthirst'
    icon = 31
    description = 'Passive: heal 6 HP whenever you land a kill.'
    tags = [bloodthirst]
}
