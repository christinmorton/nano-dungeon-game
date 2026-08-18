import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import mapState from '../../MapState.js'
import { summon } from '../../companions/summon.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Earth construct — conjure a stationary STONE SENTINEL on a tile: a turret that
// holds its ground and fires a stone bolt at the nearest enemy in range each round
// until it crumbles. Temporary (lifespan) + capped. The first user of the
// construct framework (a Follower with the 'sentinel' archetype + shoot params);
// Arcane/Fire/Ice familiars reskin the SAME summon with different identity +
// damage. Library/unslotted.

const STONE_TINT = 0x9a8b6f

export default class StoneSentinel extends Ability {
    name = 'Stone Sentinel'
    icon = 31
    description = 'Conjure a stationary stone sentinel on a tile (range 4): a turret that fires at the nearest enemy in range (5) each round. Temporary; up to 2. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 4
    radius = 0
    target = 'aoeTile'
    fxColor = STONE_TINT

    lifespan = 6              // rounds before it crumbles
    cap = 2                  // max concurrent sentinels (re-cast relocates the oldest)
    sentinelHp = 25
    shootRange = 5
    shootDamageMin = 4
    shootDamageMax = 7

    // --- Progression ladder ----------------------------------------------------
    //   L1 : 6-turn turret · range 5 · 4..7 / shot · 25 HP · max 2
    //   L2 : +2 lifespan                                                   [boost]
    //   L3 : augment — Bombard (+dmg) | Long Range (+range) | Enduring (+lifespan)
    //   L4 : a trait slot — Hardy (+HP) | Far Shot (+range) | Quickened (cd -1)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.lifespan += 2 },
    }

    augments = {
        bombard:   { label: 'Bombard', apply: a => { a.shootDamageMin += 3; a.shootDamageMax += 4 } },
        longRange: { label: 'Long Range', apply: a => { a.shootRange += 2 } },
        enduring:  { label: 'Enduring', apply: a => { a.lifespan += 4 } },
    }

    traits = {
        hardy:     bump('Hardy', 'sentinelHp', 10),
        farShot:   bump('Far Shot', 'shootRange', 1),
        quickened: quickened(1),
    }

    activate(hero, target) {
        const tile = target.tile
        if (!mapState.isWalkableTile(tile.x, tile.y)) {
            gameLog.log('There is no open ground to raise a sentinel.')
            return false
        }
        const sentinel = summon(hero, {
            tile,
            lifespan: this.lifespan,
            cap: this.cap,
            summonKind: 'stoneSentinel',
            archetype: 'sentinel',
            name: 'Stone Sentinel',
            tint: this.fxColor,
            hp: this.sentinelHp,
            stats: { STR: 6, DEX: 12, CON: 12, SPD: 8, INT: 6, Magic: 10 },
            constructParams: {
                shootRange: this.shootRange,
                shootDamageMin: this.shootDamageMin,
                shootDamageMax: this.shootDamageMax,
                shootType: 'magic',
                shootCastType: 'arcane',
                shootProjectile: { attackTile: 567, tint: this.fxColor },
            },
        })
        if (!sentinel) {
            gameLog.log('Could not raise a sentinel there.')
            return false
        }
        gameLog.log(`${hero.name} raises a stone sentinel.`)
        return true
    }
}
