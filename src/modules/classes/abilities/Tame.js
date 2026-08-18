import Passive from './Passive.js'
import TameBeast from './TameBeast.js'
import PetCommand from './PetCommand.js'
import { grantAbility, removeAbility, dismissPet } from '../../companions/pet.js'

// Tame — a PASSIVE that makes you a tamer (the Pet bond, encyclopedia §6.5).
// UNGATED + entity-agnostic: ANY hero or enemy can carry it (granted via a
// profile `passives` list or grantPassive() at runtime). It doesn't do damage —
// it's an aptitude:
//   apply()  → grants the on-demand **Tame Beast** ability (cast on a wounded
//              animal/insect to bond it as your one pet).
//   remove() → severs the pet bond (you LOSE the pet AND its progress) and strips
//              the granted abilities — the dependency rule: keep Tame to keep the
//              pet. A player who reselects their kit away from Tame loses the pet.
// Taming a beast additionally grants the **Pet** command (summon ⇄ contain), added
// by Tame Beast on a successful bond.

export default class Tame extends Passive {
    name = 'Tame'
    icon = 31
    description = 'You are a tamer: gain the Tame Beast ability and may keep one pet. Lose this passive and you lose your pet and its progress.'
    tags = []   // the capability IS the granted ability + pet bond, not a stat tag

    apply() {
        super.apply()
        grantAbility(this.entity, TameBeast)
    }

    remove() {
        super.remove()
        dismissPet(this.entity)              // lose pet + all progress
        removeAbility(this.entity, TameBeast)
        removeAbility(this.entity, PetCommand)
    }
}
