import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { dispel, heal } from '../../abilities/universals.js'
import weaken from '../../tags/weaken.js'
import { reaching, quickened, efficient } from '../../abilities/traitDefs.js'

// Holy tree — strip every positive status (buff) from a target enemy via the
// universal dispel() verb. The Cleric's answer to buffed/empowered foes (a
// shielded brute, a Blessed champion). Returns false (no cost paid) when the
// target has no buffs to purge. Library/unslotted.

export default class Dispel extends Ability {
    name = 'Dispel'
    icon = 31
    description = 'Strip all buffs from a target enemy (range 4). 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 4
    target = 'pickEnemy'
    fxColor = 0xffe39a

    draining = 0               // augment: heal self per buff stripped
    enfeebles = false          // augment: also Weaken the target

    // --- Progression ladder ----------------------------------------------------
    //   L1 : strip all buffs
    //   L2 : -2 cooldown                                                   [boost]
    //   L3 : augment — Far Dispel (+range) | Draining (heal/buff) | Enfeebling (+Weaken)
    //   L4 : a trait slot — Reaching | Quickened | Efficient
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.cooldown = Math.max(0, a.cooldown - 2) },
    }

    augments = {
        farDispel:  { label: 'Far Dispel', apply: a => { a.range += 3 } },
        draining:   { label: 'Draining',   apply: a => { a.draining = 3 } },
        enfeebling: { label: 'Enfeebling', apply: a => { a.enfeebles = true } },
    }

    traits = {
        reaching:  reaching(2),
        quickened: quickened(1),
        efficient: efficient({ ap: 1 }),
    }

    activate(hero, target) {
        const victim = target.entity
        const removed = dispel(victim)
        if (removed.length === 0) {
            gameLog.log(`${victim.name} has no buffs to dispel.`)
            return false
        }
        playCast(hero, { type: 'heal' })
        gameLog.log(`${hero.name} dispels ${victim.name}'s ${removed.join(', ')}.`)
        if (this.draining) {
            const restored = heal(hero, this.draining * removed.length)
            if (restored) gameLog.log(`${hero.name} drains ${restored} HP from the unraveling magic.`)
        }
        if (this.enfeebles) victim.addTag(weaken)
        return true
    }
}
