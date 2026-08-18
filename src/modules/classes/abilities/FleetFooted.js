import Passive from './Passive.js'
import fleetFooted from '../../tags/fleetFooted.js'

// Passive pool ability — Fleet-footed: a permanent +1 max movement point, so the
// skirmisher always has more ground to kite with. Bridge-to-tags: wraps the
// fleetFooted trait tag (bumps maxMovementPoints). Unslotted.

export default class FleetFooted extends Passive {
    name = 'Fleet-footed'
    icon = 31
    description = 'Passive: +1 movement each turn.'
    tags = [fleetFooted]
}
