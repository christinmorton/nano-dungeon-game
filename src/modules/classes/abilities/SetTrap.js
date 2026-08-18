import Ability from './Ability.js'
import { groundZone } from '../../abilities/patterns.js'
import { detonate } from '../../hazards/Hazards.js'
import { quickened, reaching, bump } from '../../abilities/traitDefs.js'

// Elf / skirmisher — lay a snare trap on a nearby tile. It sits armed; the first
// enemy to step on it is Rooted and takes a burst of spike damage. Player-placed
// and enemy-only (affects: 'enemy'), so it won't catch you or an ally — distinct
// from the dungeon-generator Traps (hazards/Trap.js), which are hidden and bite
// the hero. A pinpoint control tool vs Caltrops' area slow. Library/unslotted.
//
// Built on the hazard primitive: a single-tile groundZone whose onEnter detonates.
// It re-arms for the zone's duration (catches successive steppers); a hidden /
// one-shot variant is a later refinement.

export default class SetTrap extends Ability {
    name = 'Set Trap'
    icon = 31
    description = 'Lay a snare trap on a nearby tile — the first enemy to step on it is rooted and takes damage. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 2
    target = 'pickTile'

    fxColor = 0xc0a060          // snare-rope tan

    trapDamageMin = 8
    trapDamageMax = 14

    // Trap tunables (hoisted so the ladder can scale them).
    aoeRadius = 0               // 0 = just the trap tile; >0 = burst catches neighbors
    rootTurns = 2
    zoneDuration = 8

    // --- Progression ladder ----------------------------------------------------
    //   L1 : single-tile snare · Root 2 · 8-14 burst
    //   L2 : +3 burst damage                                              [boost]
    //   L3 : augment — Shrapnel (burst catches adjacent foes) | Ensnaring (+2 Root) |
    //        Deadfall (big burst)
    //   L4 : a trait slot — Quickened | Reaching (place range) | Heavy (+burst)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.trapDamageMin += 3; a.trapDamageMax += 4 },
    }

    augments = {
        shrapnel:  { label: 'Shrapnel', apply: a => { a.aoeRadius = 1 } },
        ensnaring: { label: 'Ensnaring', apply: a => { a.rootTurns += 2 } },
        deadfall:  { label: 'Deadfall', apply: a => { a.trapDamageMin += 6; a.trapDamageMax += 8 } },
    }

    traits = {
        quickened: quickened(1),
        reaching:  reaching(1),
        heavy:     bump('Heavy', 'trapDamageMax', 6),
    }

    activate(hero, target) {
        const tile = target.tile
        return groundZone(this, hero, [tile], {
            kind: 'web',
            duration: this.zoneDuration,
            affects: 'enemy',
            onEnterFn: (entity) => {
                detonate(tile.x, tile.y, {
                    radius: this.aoeRadius,
                    damage: { min: this.trapDamageMin, max: this.trapDamageMax },
                    damageFlavor: 'physical',
                    statuses: [{ name: 'Rooted', turns: this.rootTurns }],
                    affects: 'enemy',
                    color: this.fxColor,
                })
            },
        })
    }
}
