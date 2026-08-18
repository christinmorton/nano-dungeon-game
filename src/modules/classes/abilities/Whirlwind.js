import Ability from './Ability.js'
import dungeon from '../../Dungeon.js'
import gameLog from '../../GameLog.js'
import bleed from '../../tags/bleed.js'
import { playBurst } from '../../Animations.js'

// Physical pool ability — the "spin to win". Whirl the mainhand through
// every 8-adjacent enemy at once (full Combat pipeline per swing, like
// Cleave, so weapon flavor / crit / block all apply) and leave each victim
// Bleeding. Unslotted: no class profile lists it; built for the planned
// ability-selection pool.

export default class Whirlwind extends Ability {
    name = 'Whirlwind'
    icon = 31
    description = 'Spin to strike every adjacent enemy and cause Bleed on each. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 1
    target = 'adjacentEnemies'

    activate(hero, target) {
        const weapon = hero.currentWeapon()
        if (!weapon) {
            gameLog.log(`${hero.name} has no weapon equipped.`)
            return false
        }
        if (!target.entities.length) {
            gameLog.log(`No enemies adjacent to hit.`)
            return false
        }
        playBurst(hero.x, hero.y, { radius: 1.5 })
        for (const victim of target.entities) {
            dungeon.attackEntity(hero, victim, weapon)
            if (victim.sprite) victim.addTag(bleed)
        }
    }
}
