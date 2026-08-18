import Ability from './Ability.js'
import dungeon from '../../Dungeon.js'
import gameLog from '../../GameLog.js'

// Warrior Q — strike every 8-adjacent enemy with the equipped mainhand.
// Each victim runs through the full Combat.attack pipeline (dodge,
// block, crit, armor, element flavor) so the weapon's damageFlavor and
// weapon-tag damagedEntity hooks fire per swing, same as a normal bump
// attack would. Combat queues animations via its tween counter so
// back-to-back swings don't overlap.

export default class Cleave extends Ability {
    name = 'Cleave'
    icon = 31
    description = 'Strike every adjacent enemy with your mainhand. 1 AP, cd 2.'
    cost = { ap: 1, mp: 0 }
    cooldown = 2
    range = 1
    target = 'adjacentEnemies'

    activate(hero, target) {
        const weapon = hero.currentWeapon()
        if (!weapon) {
            gameLog.log(`${hero.name} has no weapon equipped.`)
            return false
        }
        if (!target.entities.length) {
            gameLog.log(`No enemies adjacent to cleave.`)
            return false
        }
        for (const victim of target.entities) {
            dungeon.attackEntity(hero, victim, weapon)
        }
    }
}
