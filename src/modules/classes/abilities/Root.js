import Ability from './Ability.js'
import rooted from '../../tags/rooted.js'

// Ranger E — root a single picked enemy in place for 3 turns. The victim
// can still attack from their current tile (Rooted zeros MP, not AP).
// pickEnemy mode reuses the dispatcher / HUD highlight added with
// HurlWeapon.

export default class Root extends Ability {
    name = 'Root'
    icon = 8
    description = 'Root a picked enemy in place for 5 turns (they can still attack). Range 4. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 4
    target = 'pickEnemy'

    activate(hero, target) {
        target.entity.addTag(rooted)
    }
}
