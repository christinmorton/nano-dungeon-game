import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { slam } from '../../abilities/patterns.js'

// Shove — a positioning tool: drive an adjacent enemy back via the `slam` verb,
// so if it collides with a wall, object, or another foe it's STUNNED (and the
// thing it hit is dazed). Open-space shove just slides it — aiming a target into
// terrain is the skill. Pairs with walls/hazards. Unslotted.
export default class Shove extends Ability {
    name = 'Shove'
    icon = 31
    description = 'Shove an adjacent enemy back; if it slams into a wall or another foe, it is stunned. 1 AP, cd 3.'
    cost = { ap: 1, mp: 0 }
    cooldown = 3
    range = 1
    target = 'pickEnemy'

    pushDistance = 2

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.pushDistance += 1 },
    }

    augments = {
        forceful:  { label: 'Forceful', apply: a => { a.pushDistance += 2 } },
        quickened: { label: 'Quickened', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        heavy: { label: 'Heavy', apply: a => { a.pushDistance += 1 } },
    }

    activate(hero, target) {
        const victim = target.entity
        const dx = Math.sign(victim.x - hero.x)
        const dy = Math.sign(victim.y - hero.y)
        slam(victim, dx, dy, this.pushDistance)
        gameLog.log(`${hero.name} shoves ${victim.name} back.`)
    }
}
