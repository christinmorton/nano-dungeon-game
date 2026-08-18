import Ability from './Ability.js'
import { petToggle } from '../../companions/pet.js'

// The pet-management command — auto-granted when you tame a pet (and removed with
// the Tame passive / when the bond is severed). One action that TOGGLES the pet:
// summon it to your side if contained, or contain it (pull it off-board, keeping
// its progress) if it's out. This is the in-game interaction; a richer GUI can
// replace the bar slot later. Self-target; entity-agnostic.

export default class PetCommand extends Ability {
    name = 'Pet'
    icon = 31
    description = 'Summon your pet to your side, or contain it (toggle). 1 AP.'
    cost = { ap: 1, mp: 0 }
    cooldown = 0
    range = 0
    target = 'self'

    activate(hero) {
        return petToggle(hero)
    }
}
