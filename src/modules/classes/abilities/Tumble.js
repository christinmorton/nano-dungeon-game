import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { glide } from '../../abilities/universals.js'
import evasion from '../../tags/evasion.js'
import { bump, quickened } from '../../abilities/traitDefs.js'

// Tumble — the dodge + MOBILITY combo: roll a short distance (glide) AND gain a
// brief dodge spike (the Evasion tag). The other two-primitive defense alongside
// Elusive Step (dodge + counter) — here avoidance pairs with repositioning, so you
// slip the blow and break away. Directional like Dash. Self-buff + move. Unslotted
// — an Elf/skirmisher fit.
export default class Tumble extends Ability {
    name = 'Tumble'
    icon = 31
    description = 'Roll a short distance and become briefly evasive (dodge spike). 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 2
    target = 'direction'

    fxColor = 0xa8f0d0          // agile teal

    rollSteps = 2
    dodgeAmount = 6
    dodgeTurns = 2

    // --- Progression ladder -----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.dodgeAmount += 2 },
    }

    augments = {
        farRoll: { label: 'Far Roll', apply: a => { a.rollSteps += 1; a.range += 1 } },
        nimble:  bump('Nimble', 'dodgeAmount', 3),
    }

    traits = {
        lasting:   { label: 'Lasting', apply: a => { a.dodgeTurns += 1 } },
        quickened: quickened(1),
    }

    activate(hero, target) {
        const { dx, dy } = target
        const result = glide(hero, dx, dy, this.rollSteps)
        hero.addTag(evasion, this.dodgeTurns, this.dodgeAmount)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(result.steps
            ? `${hero.name} tumbles ${result.steps} tile${result.steps === 1 ? '' : 's'} and rolls clear.`
            : `${hero.name} rolls in place, evasive.`)
    }
}
