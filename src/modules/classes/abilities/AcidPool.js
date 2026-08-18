import Ability from './Ability.js'
import { groundZone } from '../../abilities/patterns.js'
import { enlarge, quickened, bump } from '../../abilities/traitDefs.js'

// Decay utility/zone — splash a lingering pool of corrosive acid on the ground:
// a small, HIGH-damage patch that burns every enemy standing in it each round.
// The concentrated half of the tree's zone control (vs Noxious Cloud's wide,
// weaker gas). Area denial — drop it on a chokepoint or a clustered pack and make
// them eat acid to cross. Aimed at an area (aoeTile); harmless to you and allies
// (affects: 'enemy'). TEMPORARY zone (no terrain edit). Composes groundZone.
// Library/unslotted.

const ACID_TINT = 0xaaff00

export default class AcidPool extends Ability {
    name = 'Acid Pool'
    icon = 31
    description = 'Splash a corrosive pool on the ground — enemies in it take heavy acid each round. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'aoeTile'
    radius = 1
    fxColor = ACID_TINT
    damageType = 'magic'

    zoneDuration = 5
    dotMin = 5
    dotMax = 8

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r1 pool · 5-8 acid/round · 5 rounds
    //   L2 : +2 acid/round                                                 [boost]
    //   L3 : augment — Wide Pool (+radius) | Caustic (+acid) | Lingering (+duration)
    //   L4 : a trait slot — Enlarge (+radius) | Quickened | Virulent (+acid)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.dotMin += 2; a.dotMax += 2 },
    }

    augments = {
        wide:      { label: 'Wide Pool', apply: a => { a.radius += 1 } },
        caustic:   { label: 'Caustic',   apply: a => { a.dotMin += 3; a.dotMax += 4 } },
        lingering: { label: 'Lingering', apply: a => { a.zoneDuration += 4 } },
    }

    traits = {
        enlarge:   enlarge(1),
        quickened: quickened(1),
        virulent:  bump('Virulent', 'dotMax', 3),
    }

    activate(hero, target) {
        return groundZone(this, hero, target.tiles, {
            kind: 'acid',
            duration: this.zoneDuration,
            damage: { min: this.dotMin, max: this.dotMax },
            damageFlavor: 'magic',
            affects: 'enemy',
        })
    }
}
