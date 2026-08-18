import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { wall, wallLineTiles } from '../../hazards/Wall.js'
import { reaching, quickened, bump } from '../../abilities/traitDefs.js'

// Earth Wall — raise a short, temporary barrier of stone across a lane. Blocks
// enemy movement, sight, AND physical projectiles (arrows/bolts stop at the stone
// — but a spell sails through; only Arcane contains magic). The caster (and allies)
// pass freely. Composes the `wall` universal; aimed via aoeTile. (The line SCREEN;
// Stone Pillar is the single-tile SEAL.)
export default class EarthWall extends Ability {
    name = 'Earth Wall'
    icon = 31
    description = 'Raise a wall of stone — blocks enemy movement and sight for a few turns. You pass freely. 1 AP, cd 8.'
    cost = { ap: 1, mp: 0 }
    cooldown = 8
    range = 4
    radius = 0
    wallLength = 3
    wallDuration = 5            // rounds the stone holds (hoisted for the ladder)
    target = 'aoeTile'
    fxColor = 0x9a8b6f

    // --- Progression ladder ----------------------------------------------------
    //   L1 : length 3, lasts 5 rounds
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
        const { segments } = wall(tiles, { blocks: true, blocksSight: true, kind: 'earth', duration: this.wallDuration })
        if (!segments.length) {
            gameLog.log('There is no room to raise a wall there.')
            return false
        }
        gameLog.log(`${hero.name} raises a wall of stone.`)
    }
}
