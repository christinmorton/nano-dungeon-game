import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { shockwave, knockback } from '../../abilities/universals.js'

// Physical pool ability — slam the ground for a radial blast: damages every
// enemy within 2 tiles and knocks each one outward. Composes the universal
// shockwave verb. Fires whether or not anything is in range — no target
// needed, it always goes off. Unslotted.

export default class Shockwave extends Ability {
    name = 'Shockwave'
    icon = 31
    description = 'Slam the ground: damage all enemies within 2 tiles and knock them back. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 2
    target = 'self'

    activate(hero, target) {
        const damage = Math.floor(hero.stat('attackPower') / 2)
        const hits = shockwave(hero, {
            radius: 2,
            damage,
            type: 'physical',
            onHit: (victim, dx, dy) => knockback(victim, Math.sign(dx), Math.sign(dy), 1)
        })
        gameLog.log(hits.length
            ? `${hero.name} unleashes a shockwave, striking ${hits.length} enemies.`
            : `${hero.name} unleashes a shockwave.`)
    }
}
