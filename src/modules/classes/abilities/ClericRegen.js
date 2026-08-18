import Passive from './Passive.js'
import clericRegen from '../../tags/clericRegen.js'

// Cleric's Devotion passive. Bridge-to-tags: wraps the clericRegen trait
// tag (heal +1 HP each round while below 1/4 max HP). Listed in the
// Cleric profile's `passives` array; applied at construction.

export default class ClericRegen extends Passive {
    name = 'Devotion'
    icon = 31
    description = 'Passive: heal 1 HP each round while below 1/4 HP.'
    tags = [clericRegen]
}
