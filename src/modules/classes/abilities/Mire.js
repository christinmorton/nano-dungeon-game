import Ability from './Ability.js'
import { groundZone } from '../../abilities/patterns.js'
import { enlarge, quickened, bump } from '../../abilities/traitDefs.js'

// Earth utility — churn a patch of ground into clinging MIRE: difficult terrain
// that Slows every enemy crossing it and saps a little as they wade. Area denial /
// kiting — drop it in a chokepoint or between you and a charger. Aimed at an area
// (aoeTile); harmless to you and allies (affects: 'enemy'). TEMPORARY zone (no real
// terrain edit). Composes patterns.groundZone. Library/unslotted.

const MUD_TINT = 0x6b5836

export default class Mire extends Ability {
    name = 'Mire'
    icon = 31
    description = 'Churn an area into clinging mire — enemies crossing it are Slowed and sapped. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'aoeTile'
    radius = 1
    fxColor = MUD_TINT

    zoneDuration = 6
    dotMin = 1
    dotMax = 3

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r1 patch · Slow on entry · 1-3 sap/round · 6 rounds
    //   L2 : +1 sap damage                                                 [boost]
    //   L3 : augment — Wide Mire (+radius) | Cloying (+duration) | Sucking (+sap)
    //   L4 : a trait slot — Enlarge (+radius) | Quickened | Deep (+sap)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.dotMin += 1; a.dotMax += 1 },
    }

    augments = {
        wide:    { label: 'Wide Mire', apply: a => { a.radius += 1 } },
        cloying: { label: 'Cloying', apply: a => { a.zoneDuration += 4 } },
        sucking: { label: 'Sucking', apply: a => { a.dotMin += 2; a.dotMax += 3 } },
    }

    traits = {
        enlarge:   enlarge(1),
        quickened: quickened(1),
        deep:      bump('Deep', 'dotMax', 3),
    }

    activate(hero, target) {
        return groundZone(this, hero, target.tiles, {
            kind: 'oil',
            duration: this.zoneDuration,
            damage: { min: this.dotMin, max: this.dotMax },
            damageFlavor: 'physical',
            onEnter: [{ name: 'Slow', turns: 3 }],
            affects: 'enemy',
        })
    }
}
