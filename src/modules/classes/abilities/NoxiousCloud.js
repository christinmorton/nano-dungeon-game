import Ability from './Ability.js'
import { groundZone } from '../../abilities/patterns.js'
import { enlarge, quickened, bump } from '../../abilities/traitDefs.js'

// Decay utility/zone — conjure a billowing cloud of toxic fumes: a WIDE, lower-
// damage gas patch that saps every enemy who steps in (Weaken on entry) and
// chews them each round. The broad-denial half of the tree's zone control (vs
// Acid Pool's small, intense puddle) — blankets a corridor or a settlement
// doorway, debilitating a whole group. Aimed at an area (aoeTile); harmless to
// you and allies (affects: 'enemy'). TEMPORARY zone. Composes groundZone.
// Library/unslotted.
//
// The Weaken onEnter is param-safe: applyStatuses calls addTag(template, turns)
// and Weaken's first init arg IS turns (poison/acid's first arg is damage, so
// those are NOT used as onEnter riders — the per-round `damage` field carries the
// toxin instead).

const NOXIOUS_TINT = 0x7cb342

export default class NoxiousCloud extends Ability {
    name = 'Noxious Cloud'
    icon = 31
    description = 'Conjure a wide cloud of toxic fumes — enemies are Weakened on entry and take poison each round. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 5
    target = 'aoeTile'
    radius = 2
    fxColor = NOXIOUS_TINT
    damageType = 'magic'

    zoneDuration = 6
    dotMin = 2
    dotMax = 4

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 cloud · Weaken on entry · 2-4 poison/round · 6 rounds
    //   L2 : +1 poison/round                                               [boost]
    //   L3 : augment — Billowing (+radius) | Choking (+poison) | Lingering (+duration)
    //   L4 : a trait slot — Enlarge (+radius) | Quickened | Virulent (+poison)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.dotMin += 1; a.dotMax += 1 },
    }

    augments = {
        billowing: { label: 'Billowing', apply: a => { a.radius += 1 } },
        choking:   { label: 'Choking',   apply: a => { a.dotMin += 2; a.dotMax += 3 } },
        lingering: { label: 'Lingering', apply: a => { a.zoneDuration += 4 } },
    }

    traits = {
        enlarge:   enlarge(1),
        quickened: quickened(1),
        virulent:  bump('Virulent', 'dotMax', 2),
    }

    activate(hero, target) {
        return groundZone(this, hero, target.tiles, {
            kind: 'gas',
            duration: this.zoneDuration,
            damage: { min: this.dotMin, max: this.dotMax },
            damageFlavor: 'magic',
            onEnter: [{ name: 'Weaken', turns: 2 }],
            affects: 'enemy',
        })
    }
}
