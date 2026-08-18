import Ability from './Ability.js'
import dungeon from '../../Dungeon.js'
import gameLog from '../../GameLog.js'
import weaken from '../../tags/weaken.js'
import { glide } from '../../abilities/universals.js'

// Physical pool ability — a lunging thrust: glide up to 2 tiles in a
// chosen direction via the universal glide verb, striking the first enemy
// in the path and leaving them Weakened. Same line shape as Charge,
// without the knockback. Unslotted.

const MAX_STEPS = 2

export default class Lunge extends Ability {
    name = 'Lunge'
    icon = 31
    description = 'Lunge up to 2 tiles and strike the first enemy hit, weakening them. 1 AP / 1 MP, cd 3.'
    cost = { ap: 1, mp: 1 }
    cooldown = 3
    range = 2
    target = 'direction'

    activate(hero, target) {
        const { dx, dy } = target
        const weapon = hero.currentWeapon()
        const result = glide(hero, dx, dy, MAX_STEPS)
        const victim = result.blockedByEntity?.type === 'enemy' ? result.blockedByEntity : null

        if (result.steps === 0 && !victim) {
            gameLog.log(`${hero.name}'s lunge has nowhere to go.`)
            return false
        }
        if (victim && weapon) {
            dungeon.attackEntity(hero, victim, weapon)
            if (victim.sprite) victim.addTag(weaken)
        }
    }
}
