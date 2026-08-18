import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { isTameable, bondPet, grantAbility } from '../../companions/pet.js'
import PetCommand from './PetCommand.js'

// The taming CAST — granted by the Tame passive (you must be a tamer to use it).
// Target a WOUNDED living animal/insect (below the HP threshold) to bond it as
// your ONE pet (a willing contract). On a successful bond, the pet-management
// command (PetCommand: summon ⇄ contain) is automatically added to the owner.
// Entity-agnostic — any owner (hero or enemy) with the Tame passive can cast it.

const TAME_HP_FRACTION = 0.35   // only tameable once wounded below this of max HP

export default class TameBeast extends Ability {
    name = 'Tame Beast'
    icon = 31
    description = 'Bond a wounded wild beast (animal/insect below 35% HP) as your pet. 1 AP, cd 8.'
    cost = { ap: 1, mp: 0 }
    cooldown = 8
    range = 4
    target = 'pickEnemy'

    activate(hero, target) {
        const beast = target.entity
        if (!beast) return false
        if (!isTameable(beast)) {
            gameLog.log(`The ${beast.name} cannot be tamed.`)
            return false
        }
        if (beast.healthPoints > beast.maxHealthPoints * TAME_HP_FRACTION) {
            gameLog.log(`The ${beast.name} is too strong to tame — wound it first.`)
            return false
        }
        if (hero._petBond) {
            gameLog.log(`${hero.name} already has a pet — dismiss it first.`)
            return false
        }
        if (!bondPet(hero, beast)) return false
        playCast(hero, { type: 'nature' })
        grantAbility(hero, PetCommand)   // auto-add the summon ⇄ contain command
        gameLog.log(`${hero.name} tames the ${beast.name}!`)
        return true
    }
}
