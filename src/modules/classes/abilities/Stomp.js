import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { shockwave, knockback } from '../../abilities/universals.js'

// Dwarf Q — adjacent AOE, now composed from the universal shockwave verb.
// A radius-1.5 circle takes in all 8 adjacent tiles (diagonals sit at
// ~1.41), preserving the original footprint: floor(attackPower/2) raw
// damage to each, shoving every survivor 1 tile outward.

export default class Stomp extends Ability {
    name = 'Stomp'
    icon = 31
    description = 'Damage every adjacent enemy and shove them 1 tile back. 1 AP, cd 3.'
    cost = { ap: 1, mp: 0 }
    cooldown = 3
    range = 1
    target = 'self'

    activate(hero, target) {
        const damage = Math.floor(hero.stat('attackPower') / 2)
        const hits = shockwave(hero, {
            radius: 1.5,
            damage,
            type: 'physical',
            onHit: (victim, dx, dy) => knockback(victim, Math.sign(dx), Math.sign(dy), 1)
        })
        if (!hits.length) {
            gameLog.log(`No enemies adjacent to stomp.`)
            return false
        }
        for (const { entity, result } of hits) {
            gameLog.log(`Stomp hits ${entity.name} for ${result.applied}.`)
        }
    }
}
