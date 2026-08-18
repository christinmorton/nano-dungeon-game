import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { wall, wallLineTiles } from '../../hazards/Wall.js'
import { reaching, quickened, bump } from '../../abilities/traitDefs.js'

// Fire Wall — conjure a line of flame. Does NOT block movement; instead it
// burns AND snares enemies that cross it: on entry they're Rooted for one turn
// (caught in the flames — and so they eat a tick of fire), then left Slowed for
// a few turns, with Burning DoT on top. The caster and allies pass unharmed.
// The "damage + crowd-control" wall (weakest of the set, but the only one that
// reliably hurts). Composes the `wall` universal.
export default class FireWall extends Ability {
    name = 'Fire Wall'
    icon = 31
    description = 'Conjure a line of flame — enemies crossing it are caught (rooted 1 turn), burned, then slowed. You pass unharmed. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    radius = 0
    wallLength = 3
    wallDuration = 4            // rounds the flames persist (hoisted for the ladder)
    target = 'aoeTile'
    fxColor = 0xff6622

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
        if (!tiles.length) {
            gameLog.log('There is no room for the flames there.')
            return false
        }
        wall(tiles, {
            blocks: false,
            kind: 'fire',
            duration: this.wallDuration,
            damage: { min: 2, max: 4 },
            damageFlavor: 'fire',
            // On entry: caught in the flames (Root 1 turn -> eats a fire tick),
            // then Slowed for a few; Burning DoT layered on. onTick keeps standers
            // burning without re-applying the snare each round.
            onEnter: ['Burning', { name: 'Rooted', turns: 1 }, { name: 'Slow', turns: 4 }],
            onTick: 'Burning',
            affects: 'enemy',
        })
        gameLog.log(`${hero.name} conjures a wall of fire.`)
    }
}
