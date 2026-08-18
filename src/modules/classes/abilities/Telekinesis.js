import Ability from './Ability.js'
import { telekinesis } from '../../abilities/patterns.js'
import { reaching, quickened, bump } from '../../abilities/traitDefs.js'

// Arcane world-interaction — the move-object spell. Aim a tile in range and shove
// whatever's there one step: hurl an enemy back, shove a loose prop, drag a hazard
// cloud aside, or trigger a chest / lever / unlocked door / loot bag from afar.
// REFUSES sturdy walls + locked doors (the Breach precedent); does NOT grab traps
// (parked, user call). Delivery = patterns.telekinesis (the new move-object verb).
// aoeTile (radius 0) so the aimed tile MAY be occupied. Library/unslotted.

export default class Telekinesis extends Ability {
    name = 'Telekinesis'
    icon = 31
    description = 'Telekinetically shove the targeted tile (range 4): hurl an enemy, shove a prop/hazard, or trigger a chest/lever/door. Refuses sturdy walls + locked doors. 1 AP, cd 3.'
    cost = { ap: 1, mp: 0 }
    cooldown = 3
    range = 4
    target = 'aoeTile'
    radius = 0                  // single tile — aoeTile lets the target be occupied
    fxColor = 0xc084fc

    distance = 1                // tiles shoved; the ladder can grow it

    // --- Progression ladder ----------------------------------------------------
    //   L1 : shove 1 tile, range 4
    //   L2 : shove 2 tiles                                                 [boost]
    //   L3 : augment — Forceful (+2 shove) | Far Reach (+range) | Rapid Pull (cd -1)
    //   L4 : a trait slot — Forceful (+1 shove) | Reaching | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.distance += 1 },        // 1 -> 2 tiles
    }

    augments = {
        forceful: { label: 'Forceful', apply: a => { a.distance += 2 } },
        farReach: { label: 'Far Reach', apply: a => { a.range += 3 } },
        rapid:    { label: 'Rapid Pull', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        forceful:  bump('Forceful', 'distance', 1),
        reaching:  reaching(2),
        quickened: quickened(1),
    }

    activate(hero, target) {
        return telekinesis(this, hero, target, { castType: 'arcane' })
    }
}
