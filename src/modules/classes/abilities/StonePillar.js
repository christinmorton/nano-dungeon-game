import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { wall } from '../../hazards/Wall.js'
import { reaching, quickened, bump } from '../../abilities/traitDefs.js'

// Earth utility — raise a single SOLID pillar of stone on a tile: an opaque seal
// that blocks movement, sight, and physical projectiles — plug a doorway or
// corridor, or drop cover mid-fight. The caster + allies pass freely (faction-aware
// wall). Earth's pathway-block (the user's "stone slab"), the single-tile cousin of
// Earth Wall's line. TEMPORARY (no real terrain edit — a timed structure). Composes
// the `wall` universal. Library/unslotted.

const EARTH_TINT = 0x8a7b5a

export default class StonePillar extends Ability {
    name = 'Stone Pillar'
    icon = 31
    description = 'Raise a solid pillar of stone on a tile (range 5): a total seal — blocks movement, sight, and arrows (spells pass). You and allies pass freely. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 5
    radius = 0
    target = 'aoeTile'
    pillarDuration = 6         // rounds the pillar stands
    fxColor = EARTH_TINT

    // --- Progression ladder ----------------------------------------------------
    //   L1 : stands 6 rounds
    //   L2 : +2 rounds                                                     [boost]
    //   L3 : augment — Enduring Pillar (+4 rounds) | Swift (cd -2) | Far Reach (+range)
    //   L4 : a trait slot — Lasting (+rounds) | Quickened (cd -1) | Reaching (+range)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.pillarDuration += 2 },
    }

    augments = {
        enduring: { label: 'Enduring Pillar', apply: a => { a.pillarDuration += 4 } },
        swift:    { label: 'Swift Raise', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
        farReach: { label: 'Far Reach', apply: a => { a.range += 3 } },
    }

    traits = {
        lasting:   bump('Lasting', 'pillarDuration', 2),
        quickened: quickened(1),
        reaching:  reaching(2),
    }

    activate(hero, target) {
        const { segments } = wall([target.tile], {
            blocks: true,
            blocksSight: true,
            kind: 'earth',
            duration: this.pillarDuration,
        })
        if (!segments.length) {
            gameLog.log('There is no room to raise a pillar there.')
            return false
        }
        gameLog.log(`${hero.name} raises a pillar of stone.`)
    }
}
