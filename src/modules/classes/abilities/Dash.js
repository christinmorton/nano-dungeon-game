import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { glide } from '../../abilities/universals.js'

// Ranger Q — directional sprint via the universal glide verb. Up to 3
// tiles, no attack, no status. Costs only MP so the ranger can dash AND
// attack in the same turn if both budgets allow.

const MAX_STEPS = 3

export default class Dash extends Ability {
    name = 'Dash'
    icon = 6
    description = 'Glide up to 3 tiles in a direction. No attack. 0 AP / 2 MP, cd 1.'
    cost = { ap: 0, mp: 2 }
    cooldown = 1
    range = 3
    target = 'direction'

    activate(hero, target) {
        const { dx, dy } = target
        const result = glide(hero, dx, dy, MAX_STEPS)
        if (result.steps === 0) {
            gameLog.log(`${hero.name} has no room to dash.`)
            return false
        }
        gameLog.log(`${hero.name} dashes ${result.steps} tile${result.steps === 1 ? '' : 's'}.`)
    }
}
