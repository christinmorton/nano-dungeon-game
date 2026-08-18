import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import mapState from '../../MapState.js'
import { summon } from '../../companions/summon.js'
import burning from '../../tags/burning.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Fire construct — conjure a stationary FIRE GOLEM: a turret that hurls fire at the
// nearest enemy in range each round and sets them BURNING (its element special).
// Same construct framework as Stone Sentinel (the `sentinel` archetype), reskinned
// fire — base golem sprite + a fire tint for now (a bespoke PixelLab sprite is
// parked). Temporary + capped. Library/unslotted.

const FIRE_TINT = 0xff6622

export default class FireGolem extends Ability {
    name = 'Fire Golem'
    icon = 31
    description = 'Conjure a stationary fire golem on a tile (range 4): it hurls fire at the nearest enemy in range (5) each round, setting them Burning. Temporary; up to 2. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 4
    radius = 0
    target = 'aoeTile'
    fxColor = FIRE_TINT

    lifespan = 6
    cap = 2
    golemHp = 28
    shootRange = 5
    shootDamageMin = 4
    shootDamageMax = 7

    // --- Progression ladder ----------------------------------------------------
    //   L3 augment — Conflagration (+dmg) | Long Range (+range) | Enduring (+lifespan)
    //   L4 trait — Hardy (+HP) | Far Shot (+range) | Quickened (cd -1)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.lifespan += 2 },
    }

    augments = {
        conflagration: { label: 'Conflagration', apply: a => { a.shootDamageMin += 3; a.shootDamageMax += 4 } },
        longRange:     { label: 'Long Range', apply: a => { a.shootRange += 2 } },
        enduring:      { label: 'Enduring', apply: a => { a.lifespan += 4 } },
    }

    traits = {
        hardy:     bump('Hardy', 'golemHp', 10),
        farShot:   bump('Far Shot', 'shootRange', 1),
        quickened: quickened(1),
    }

    activate(hero, target) {
        const tile = target.tile
        if (!mapState.isWalkableTile(tile.x, tile.y)) {
            gameLog.log('There is no open ground to raise a golem.')
            return false
        }
        const golem = summon(hero, {
            tile,
            lifespan: this.lifespan,
            cap: this.cap,
            summonKind: 'fireGolem',
            archetype: 'sentinel',
            name: 'Fire Golem',
            tint: this.fxColor,
            hp: this.golemHp,
            stats: { STR: 8, DEX: 11, CON: 13, SPD: 8, INT: 6, Magic: 11 },
            constructParams: {
                shootRange: this.shootRange,
                shootDamageMin: this.shootDamageMin,
                shootDamageMax: this.shootDamageMax,
                shootType: 'magic',
                shootCastType: 'fire',
                shootStatus: burning,                 // its special: burns what it hits
                shootProjectile: { attackTile: 567, tint: this.fxColor },
            },
        })
        if (!golem) {
            gameLog.log('Could not raise a golem there.')
            return false
        }
        gameLog.log(`${hero.name} conjures a fire golem.`)
        return true
    }
}
