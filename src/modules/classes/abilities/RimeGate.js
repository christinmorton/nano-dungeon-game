import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { wall } from '../../hazards/Wall.js'
import { reaching, quickened, bump } from '../../abilities/traitDefs.js'

// Ice utility / world-interaction — the "ice door". Conjure a SOLID block of ice
// on a single tile: a total SEAL that blocks movement, sight, AND physical
// projectiles — plug a doorway or corridor to wall a room off. (Spells still melt
// through; only Arcane contains magic.) The caster + allies pass freely
// (faction-aware wall). Distinct from Rime Wall, which is a see-through LINE that
// only blocks movement — Rime Gate is the opaque single-tile SEAL. Composes the
// `wall` universal (1 tile, blocksSight). Earth will get its own pathway-block
// later, done differently (a stone slab / collapse).

const ICE_TINT = 0x9fd8ff

export default class RimeGate extends Ability {
    name = 'Rime Gate'
    icon = 31
    description = 'Conjure a door of ice on a tile (range 5): a total seal — blocks movement, sight, and arrows (spells melt through). You and allies pass freely. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 5
    radius = 0
    target = 'aoeTile'
    gateDuration = 6           // rounds the ice door holds
    fxColor = ICE_TINT

    // --- Progression ladder ----------------------------------------------------
    //   L1 : holds 6 rounds
    //   L2 : +2 rounds                                                     [boost]
    //   L3 : augment — Lasting Gate (+4 rounds) | Swift Gate (cd -2) | Far Reach (+range)
    //   L4 : a trait slot — Lasting (+rounds) | Quickened (cd -1) | Reaching (+range)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.gateDuration += 2 },
    }

    augments = {
        lasting:  { label: 'Lasting Gate', apply: a => { a.gateDuration += 4 } },
        swift:    { label: 'Swift Gate', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
        farReach: { label: 'Far Reach', apply: a => { a.range += 3 } },
    }

    traits = {
        lasting:   bump('Lasting', 'gateDuration', 2),
        quickened: quickened(1),
        reaching:  reaching(2),
    }

    activate(hero, target) {
        const { segments } = wall([target.tile], {
            blocks: true,
            blocksSight: true,
            kind: 'rime',
            duration: this.gateDuration,
        })
        if (!segments.length) {
            gameLog.log('There is no room to conjure ice there.')
            return false
        }
        gameLog.log(`${hero.name} conjures a door of ice.`)
    }
}
