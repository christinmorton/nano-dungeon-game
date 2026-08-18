import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import fear from '../../tags/fear.js'

// Intimidate — break a foe's nerve: a glare/roar that strikes Fear into a single
// enemy, sending it fleeing (the wired Fear / mindControl behavior). The martial
// answer to control — no damage, pure CC. This is the first ability to APPLY
// Fear (it was wired but unowned). Unslotted.
export default class Intimidate extends Ability {
    name = 'Intimidate'
    icon = 31
    description = "Break a foe's nerve — it flees in Fear. 1 AP, cd 5."
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 2
    target = 'pickEnemy'
    appliesStatus = fear

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.range += 1 },
    }

    augments = {
        menacing:  { label: 'Menacing', apply: a => { a.range += 1 } },
        quickened: { label: 'Quickened', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        farReach: { label: 'Far Reach', apply: a => { a.range += 1 } },
    }

    activate(hero, target) {
        const victim = target.entity
        for (const s of [].concat(this.appliesStatus || [])) victim.addTag(s)
        gameLog.log(`${hero.name} intimidates ${victim.name}!`)
    }
}
