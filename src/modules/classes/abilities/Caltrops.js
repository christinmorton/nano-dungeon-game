import Ability from './Ability.js'
import { groundZone } from '../../abilities/patterns.js'
import { enlarge, quickened, bump } from '../../abilities/traitDefs.js'

// Elf / skirmisher — area denial. Scatter caltrops over a patch of ground: enemies
// that stand in or cross it are Slowed and bleed/chip from the spikes. Drop it in a
// chokepoint or between you and a charger to buy kiting room. Aimed at an area
// (aoeTile); harmless to you and allies (affects: 'enemy'). Library/unslotted.

export default class Caltrops extends Ability {
    name = 'Caltrops'
    icon = 31
    description = 'Scatter caltrops over an area — enemies crossing it are slowed and take damage. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'aoeTile'
    radius = 1                  // small patch (aoeTile preview + footprint)

    fxColor = 0xb8a888          // dull iron — matches the ZoneEffect 'caltrops' style

    // Zone tunables (hoisted so the ladder can scale them).
    zoneDuration = 6
    dotMin = 2
    dotMax = 4

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r1 patch · 2-4 chip · Slow + Bleed on entry · 6 rounds
    //   L2 : +1 chip damage                                               [boost]
    //   L3 : augment — Wide Scatter (+1 radius) | Tar-coated (+4 duration) | Jagged (+dmg)
    //   L4 : a trait slot — Enlarge (+radius) | Quickened | Deep (+chip)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.dotMin += 1; a.dotMax += 2 },
    }

    augments = {
        wide:   { label: 'Wide Scatter', apply: a => { a.radius += 1 } },
        tar:    { label: 'Tar-coated', apply: a => { a.zoneDuration += 4 } },
        jagged: { label: 'Jagged', apply: a => { a.dotMin += 2; a.dotMax += 3 } },
    }

    traits = {
        enlarge:   enlarge(1),
        quickened: quickened(1),
        deep:      bump('Deep', 'dotMax', 3),
    }

    activate(hero, target) {
        return groundZone(this, hero, target.tiles, {
            kind: 'caltrops',
            duration: this.zoneDuration,
            damage: { min: this.dotMin, max: this.dotMax },   // chip per round standing on them
            damageFlavor: 'physical',
            // On step: Slowed (sluggish from the spikes) + a Bleed from the cuts.
            onEnter: [{ name: 'Slow', turns: 3 }, { name: 'Bleed', turns: 3 }],
            affects: 'enemy',
        })
    }
}
