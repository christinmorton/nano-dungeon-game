import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import mapState from '../../MapState.js'
import { summon } from '../../companions/summon.js'
import slow from '../../tags/slow.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Ice construct — conjure a stationary ICE FAMILIAR: a turret that fires ice shards
// at the nearest enemy in range each round and SLOWS them (its element special —
// great for kiting / locking a pack down with the rest of the Ice kit). Same
// construct framework as Stone Sentinel (the `sentinel` archetype), reskinned ice —
// base golem sprite + a blue tint for now (PixelLab sprite parked). Temporary +
// capped. Library/unslotted.

const ICE_TINT = 0x6ab8ff

export default class IceFamiliar extends Ability {
    name = 'Ice Familiar'
    icon = 31
    description = 'Conjure a stationary ice familiar on a tile (range 4): it fires ice shards at the nearest enemy in range (5) each round, Slowing them. Temporary; up to 2. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 4
    radius = 0
    target = 'aoeTile'
    fxColor = ICE_TINT

    lifespan = 6
    cap = 2
    familiarHp = 24
    shootRange = 5
    shootDamageMin = 3          // a touch lower base — the Slow is the value
    shootDamageMax = 6

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.lifespan += 2 },
    }

    augments = {
        biting:    { label: 'Biting Cold', apply: a => { a.shootDamageMin += 3; a.shootDamageMax += 4 } },
        longRange: { label: 'Long Range', apply: a => { a.shootRange += 2 } },
        enduring:  { label: 'Enduring', apply: a => { a.lifespan += 4 } },
    }

    traits = {
        hardy:     bump('Hardy', 'familiarHp', 10),
        farShot:   bump('Far Shot', 'shootRange', 1),
        quickened: quickened(1),
    }

    activate(hero, target) {
        const tile = target.tile
        if (!mapState.isWalkableTile(tile.x, tile.y)) {
            gameLog.log('There is no open ground to conjure a familiar.')
            return false
        }
        const familiar = summon(hero, {
            tile,
            lifespan: this.lifespan,
            cap: this.cap,
            summonKind: 'iceFamiliar',
            archetype: 'sentinel',
            name: 'Ice Familiar',
            tint: this.fxColor,
            hp: this.familiarHp,
            stats: { STR: 5, DEX: 12, CON: 11, SPD: 8, INT: 7, Magic: 12 },
            constructParams: {
                shootRange: this.shootRange,
                shootDamageMin: this.shootDamageMin,
                shootDamageMax: this.shootDamageMax,
                shootType: 'magic',
                shootCastType: 'frost',
                shootStatus: slow,                    // its special: chills/slows what it hits
                shootProjectile: { attackTile: 574, tint: this.fxColor },
            },
        })
        if (!familiar) {
            gameLog.log('Could not conjure a familiar there.')
            return false
        }
        gameLog.log(`${hero.name} conjures an ice familiar.`)
        return true
    }
}
