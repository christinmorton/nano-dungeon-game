import Passive from './Passive.js'
import warriorEnrage from '../../tags/warriorEnrage.js'

// Warrior's Enrage passive. Bridge-to-tags: wraps the warriorEnrage trait
// tag (+floor(STR/2) attackPower while below 1/3 max HP). Listed in the
// Warrior profile's `passives` array; applied at construction.

export default class WarriorEnrage extends Passive {
    name = 'Enrage'
    icon = 31
    description = 'Passive: while below 1/3 HP, gain +floor(STR/2) attack power.'
    tags = [warriorEnrage]
}
