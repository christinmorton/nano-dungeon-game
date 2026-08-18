import Passive from './Passive.js'
import fastHands from '../../tags/fastHands.js'

// Passive pool ability — Fast Hands: ability cooldowns recover twice as fast.
// Bridge-to-tags: wraps the fastHands trait tag (an extra cooldown tick per round).
//
// This is the RENAMED "Quickdraw passive" — the Quickdraw NAME stays on the active
// buff (classes/abilities/Quickdraw.js, user's call); the passive took a new name
// to avoid the collision. Unslotted.

export default class FastHands extends Passive {
    name = 'Fast Hands'
    icon = 31
    description = 'Passive: ability cooldowns recover twice as fast.'
    tags = [fastHands]
}
