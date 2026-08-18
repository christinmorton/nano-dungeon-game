import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { wall, wallLineTiles } from '../../hazards/Wall.js'
import { reaching, quickened, bump } from '../../abilities/traitDefs.js'

// Rime Wall — a short barrier of ice. Blocks enemy movement and physical
// projectiles (arrows stop at the ice) but NOT sight (see-through) and NOT
// spells (a fireball melts through; only Arcane contains magic). Lasts a little
// less than stone before it shatters. The caster and allies pass through freely.
// Composes the `wall` universal. (The see-through anti-melee SCREEN; Rime Gate is
// the opaque single-tile SEAL.)
export default class RimeWall extends Ability {
    name = 'Rime Wall'
    icon = 31
    description = 'Raise a wall of ice — blocks enemy movement (but not sight) for a few turns. You pass freely. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    radius = 0
    wallLength = 3
    wallDuration = 4            // rounds the ice persists (hoisted for the ladder)
    target = 'aoeTile'
    fxColor = 0x6ab8ff

    // --- Progression ladder ----------------------------------------------------
    //   L1 : length 3, lasts 4 rounds
    //   L2 : +1 length                                                     [boost]
    //   L3 : augment — Greater Wall (+2 length) | Lasting Wall (+3 rounds) | Swift (cd -2)
    //   L4 : a trait slot — Extended (+length) | Reaching (+range) | Quickened (cd -1)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.wallLength += 1 },
    }

    augments = {
        greater: { label: 'Greater Wall', apply: a => { a.wallLength += 2 } },
        lasting: { label: 'Lasting Wall', apply: a => { a.wallDuration += 3 } },
        swift:   { label: 'Swift Wall', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        extended:  bump('Extended', 'wallLength', 1),
        reaching:  reaching(2),
        quickened: quickened(1),
    }

    activate(hero, target) {
        const tiles = wallLineTiles(hero, target.tile, this.wallLength)
        const { segments } = wall(tiles, { blocks: true, blocksSight: false, kind: 'rime', duration: this.wallDuration })
        if (!segments.length) {
            gameLog.log('There is no room to raise a wall there.')
            return false
        }
        gameLog.log(`${hero.name} raises a wall of ice.`)
    }
}
