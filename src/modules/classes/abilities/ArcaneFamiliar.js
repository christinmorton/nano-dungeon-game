import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import mapState from '../../MapState.js'
import { summon } from '../../companions/summon.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Arcane construct — conjure a stationary ARCANE FAMILIAR: a turret that fires Mana
// Darts at the nearest enemy in range each round. Its special is reliable, clean
// arcane damage (no element rider — pure force; the highest base damage of the
// familiars). Same construct framework as Stone Sentinel (the `sentinel` archetype),
// reskinned arcane — base golem sprite + a violet tint for now (PixelLab sprite
// parked). Temporary + capped. Library/unslotted.

const ARCANE_TINT = 0xc084fc

export default class ArcaneFamiliar extends Ability {
    name = 'Arcane Familiar'
    icon = 31
    description = 'Conjure a stationary arcane familiar on a tile (range 4): it fires mana darts at the nearest enemy in range (5) each round. Temporary; up to 2. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 4
    radius = 0
    target = 'aoeTile'
    fxColor = ARCANE_TINT

    lifespan = 6
    cap = 2
    familiarHp = 22
    shootRange = 5
    shootDamageMin = 5          // higher base (its special: clean reliable arcane damage)
    shootDamageMax = 9

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.lifespan += 2 },
    }

    augments = {
        overcharged: { label: 'Overcharged', apply: a => { a.shootDamageMin += 3; a.shootDamageMax += 4 } },
        longRange:   { label: 'Long Range', apply: a => { a.shootRange += 2 } },
        enduring:    { label: 'Enduring', apply: a => { a.lifespan += 4 } },
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
            summonKind: 'arcaneFamiliar',
            archetype: 'sentinel',
            name: 'Arcane Familiar',
            tint: this.fxColor,
            hp: this.familiarHp,
            stats: { STR: 5, DEX: 13, CON: 10, SPD: 9, INT: 8, Magic: 13 },
            constructParams: {
                shootRange: this.shootRange,
                shootDamageMin: this.shootDamageMin,
                shootDamageMax: this.shootDamageMax,
                shootType: 'magic',
                shootCastType: 'arcane',
                shootProjectile: { attackTile: 567, tint: this.fxColor },
            },
        })
        if (!familiar) {
            gameLog.log('Could not conjure a familiar there.')
            return false
        }
        gameLog.log(`${hero.name} conjures an arcane familiar.`)
        return true
    }
}
