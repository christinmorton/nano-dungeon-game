import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import guarded from '../../tags/guarded.js'
import { heal } from '../../abilities/universals.js'
import { bump } from '../../abilities/traitDefs.js'

// Last Stand — a low-HP defensive surge: only usable when badly wounded, it digs
// in for a big all-round guard (+armor & magic resist, the Guarded tag) and
// recovers some health — the cornered-bruiser comeback button. Self-buff,
// HP-gated. Unslotted.
export default class LastStand extends Ability {
    name = 'Last Stand'
    icon = 31
    description = 'Only when badly wounded: dig in for a powerful guard (+armor & magic resist) and recover health. 1 AP, cd 8.'
    cost = { ap: 1, mp: 0 }
    cooldown = 8
    range = 0
    target = 'self'

    hpThreshold = 0.5    // usable only below this fraction of max HP
    guardAmount = 15
    guardTurns = 3
    healAmount = 20

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.guardAmount += 5; a.healAmount += 10 },
    }

    augments = {
        unbreakable: bump('Unbreakable', 'guardAmount', 8),
        rally:       bump('Rally', 'healAmount', 20),
    }

    traits = {
        defiant: { label: 'Defiant', apply: a => { a.guardTurns += 2 } },
    }

    activate(hero, target) {
        if (hero.healthPoints > hero.maxHealthPoints * this.hpThreshold) {
            gameLog.log(`${hero.name} can only make a Last Stand when badly wounded.`)
            return false
        }
        hero.addTag(guarded, this.guardTurns, this.guardAmount)
        if (this.healAmount > 0) heal(hero, this.healAmount)
        gameLog.log(`${hero.name} makes a last stand!`)
    }
}
