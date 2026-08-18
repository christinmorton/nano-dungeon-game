import Ability from './Ability.js'
import { groundZone } from '../../abilities/patterns.js'
import { enlarge, quickened, bump } from '../../abilities/traitDefs.js'

// Earth support — raise a warding standing-stone over an area: a defensive ZONE
// that grants Guarded (+armor & magic resist) to allies standing in it each round.
// Party/defensive support — hold a chokepoint or anchor a fight against a horde
// from inside the ward. A buff-zone via patterns.groundZone (NOT a follower
// construct), so it's buildable + temporary. Library/unslotted.
//
// NOTE: `affects: 'hero'` buffs the HERO today; buffing summoned/party allies needs
// the team-aware-zone extension (ties to the parked Party system) — a small follow-up.

const WARD_TINT = 0x7a9a6f

export default class WardStone extends Ability {
    name = 'Ward Stone'
    icon = 31
    description = 'Raise a warding stone over an area (range 5): you (and allies) standing in it gain Guarded — +armor & magic resist — each round. Hold a chokepoint vs a horde. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 5
    target = 'aoeTile'
    radius = 1
    fxColor = WARD_TINT

    zoneDuration = 6
    wardStatuses = ['Guarded']    // buffs granted in the zone (extensible by augments)

    // --- Progression ladder (varied: a NUMBER-scaling set + an EFFECT-ADDING augment) ---
    //   L1 : r1 ward · Guarded in-zone · 6 rounds
    //   L2 : +1 radius                                                     [boost]
    //   L3 : augment — Wide Ward (+radius) | Enduring Ward (+duration) | Bulwark Stone (ALSO grants Stoneskin)
    //   L4 : a trait slot — Enlarge (+radius) | Lasting (+duration) | Quickened (cd -1)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1 },
    }

    augments = {
        wide:     { label: 'Wide Ward', apply: a => { a.radius += 1 } },
        enduring: { label: 'Enduring Ward', apply: a => { a.zoneDuration += 4 } },
        // Effect-ADDING augment (a "different type" of upgrade vs pure number-scaling):
        // the ward also grants Stoneskin, layering +armor on top of Guarded.
        bulwark:  { label: 'Bulwark Stone', apply: a => { a.wardStatuses = [...a.wardStatuses, 'Stoneskin'] } },
    }

    traits = {
        enlarge:   enlarge(1),
        lasting:   bump('Lasting', 'zoneDuration', 2),
        quickened: quickened(1),
    }

    activate(hero, target) {
        return groundZone(this, hero, target.tiles, {
            kind: 'web',                    // pale, stony zone style
            duration: this.zoneDuration,
            damage: null,
            onTick: this.wardStatuses,      // re-buff standers each round
            onEnter: this.wardStatuses,     // and immediately on step-in
            affects: 'hero',                // allies; team-aware ally support is a follow-up
        })
    }
}
