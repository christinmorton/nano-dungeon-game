import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { knockback } from '../../abilities/universals.js'
import { wall, wallLineTiles } from '../../hazards/Wall.js'

// Gale Wall — the DISPLACE wall. A line of howling wind that neither blocks nor
// burns: any enemy that steps into it is SHOVED back the way it came, so it
// can't push through. The caster and allies pass freely. Little/no damage —
// pure soft control. Composes the `wall` universal via an on-enter knockback
// hook (the wind tier of the wall set).
export default class GaleWall extends Ability {
    name = 'Gale Wall'
    icon = 31
    description = 'Raise a line of wind — enemies that try to cross are shoved back. You pass freely. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    radius = 0
    wallLength = 3
    target = 'aoeTile'

    activate(hero, target) {
        const tiles = wallLineTiles(hero, target.tile, this.wallLength)
        const { zone } = wall(tiles, {
            blocks: false,
            kind: 'wind',
            duration: 4,
            affects: 'enemy',
            // Shove the crosser one tile back, away from the caster's side.
            onEnterFn: (victim) => {
                const dx = Math.sign(victim.x - hero.x)
                const dy = Math.sign(victim.y - hero.y)
                if (dx !== 0 || dy !== 0) knockback(victim, dx, dy, 1)
            },
        })
        if (!zone) {
            gameLog.log('There is no room for the wind there.')
            return false
        }
        gameLog.log(`${hero.name} raises a wall of wind.`)
    }
}
