import Ability from './Ability.js'
import { swap } from '../../abilities/patterns.js'
import daze from '../../tags/daze.js'
import { reaching, quickened, efficient } from '../../abilities/traitDefs.js'

// Spatial tree — WARP: trade places with a target enemy in an instant. Slip out of
// a corner, dive past a frontliner, or yank a threat off a vulnerable spot by
// taking its place. Pure repositioning, no damage. Composes the `swap` pattern.
// The Disorienting augment leaves the swapped foe Dazed (a beat to capitalize).
// Library/unslotted (Spatial).

const SPATIAL_TINT = 0x9a7bff

export default class Warp extends Ability {
    name = 'Warp'
    icon = 31
    description = 'Instantly swap places with an enemy (range 5). No damage — pure repositioning. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 5
    target = 'pickEnemy'
    fxColor = SPATIAL_TINT

    disorients = false         // augment: Daze the swapped enemy

    // --- Progression ladder ----------------------------------------------------
    //   L1 : swap, range 5
    //   L2 : +2 range                                                      [boost]
    //   L3 : augment — Far Warp (+range) | Disorienting (Daze the foe) | Rapid (cd -1)
    //   L4 : a trait slot — Reaching | Quickened | Efficient
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.range += 2 },
    }

    augments = {
        farWarp:     { label: 'Far Warp',     apply: a => { a.range += 3 } },
        disorienting:{ label: 'Disorienting', apply: a => { a.disorients = true } },
        rapid:       { label: 'Rapid',        apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        reaching:  reaching(2),
        quickened: quickened(1),
        efficient: efficient({ ap: 1 }),
    }

    activate(hero, target) {
        const victim = target.entity
        const did = swap(this, hero, victim, { castType: 'arcane' })
        if (did && this.disorients && victim.sprite) victim.addTag(daze)
        return did
    }
}
