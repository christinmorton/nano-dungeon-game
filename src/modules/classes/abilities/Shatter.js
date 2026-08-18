import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import sunder from '../../tags/sunder.js'
import { resolveDamage } from '../../abilities/universals.js'
import { playBurst } from '../../Animations.js'

// Physical pool ability — a ground-shattering swing that hits every
// 8-adjacent enemy for raw attackPower-scaled damage and Sunders their
// armor. Same raw-damage shape as Stomp (no weapon required). Unslotted.

export default class Shatter extends Ability {
    name = 'Shatter'
    icon = 31
    description = 'Damage every adjacent enemy and Sunder their armor. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 1
    target = 'adjacentEnemies'

    activate(hero, target) {
        if (!target.entities.length) {
            gameLog.log(`No enemies adjacent to shatter.`)
            return false
        }
        playBurst(hero.x, hero.y, { radius: 1.5, color: 0xd9c2a0 })
        const rawDamage = Math.floor(hero.stat('attackPower') / 2)
        for (const victim of target.entities) {
            const result = resolveDamage(victim, rawDamage, 'physical')
            gameLog.log(`Shatter hits ${victim.name} for ${result.applied}.`)
            if (!result.killed) victim.addTag(sunder)
        }
    }
}
