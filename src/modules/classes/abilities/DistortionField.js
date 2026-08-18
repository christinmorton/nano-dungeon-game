import Ability from './Ability.js'
import { groundZone } from '../../abilities/patterns.js'
import { knockback } from '../../abilities/universals.js'
import { enlarge, quickened, bump } from '../../abilities/traitDefs.js'

// Spatial tree — DISTORTION FIELD: warp the space over an area so any enemy that
// steps in is flung back out (knockback away from the field's center). A repulsor /
// area-denial zone — seal a doorway or keep a melee pack at bay while you work.
// The tree's light control slice. Composes groundZone + an onEnterFn that pushes
// the crosser away from center. TEMPORARY zone; harmless to you and allies
// (affects:'enemy'). Library/unslotted (Spatial).

const SPATIAL_TINT = 0x9a7bff

export default class DistortionField extends Ability {
    name = 'Distortion Field'
    icon = 31
    description = 'Warp space over an area — enemies that enter are flung back out. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'aoeTile'
    radius = 1
    fxColor = SPATIAL_TINT
    damageType = 'magic'

    zoneDuration = 5
    pushDistance = 2

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r1 field · fling 2 tiles · 5 rounds
    //   L2 : +2 duration                                                   [boost]
    //   L3 : augment — Wide (+radius) | Enduring (+duration) | Violent (+push)
    //   L4 : a trait slot — Enlarge (+radius) | Quickened | Violent (+push)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.zoneDuration += 2 },
    }

    augments = {
        wide:     { label: 'Wide',     apply: a => { a.radius += 1 } },
        enduring: { label: 'Enduring', apply: a => { a.zoneDuration += 4 } },
        violent:  { label: 'Violent',  apply: a => { a.pushDistance += 2 } },
    }

    traits = {
        enlarge:   enlarge(1),
        quickened: quickened(1),
        violent:   bump('Violent', 'pushDistance', 1),
    }

    activate(hero, target) {
        const center = target.tile
        const push = this.pushDistance
        return groundZone(this, hero, target.tiles, {
            kind: 'default',          // violet distortion
            duration: this.zoneDuration,
            damage: null,
            affects: 'enemy',
            onEnterFn: (e) => {
                if (!e?.sprite) return
                let dx = Math.sign(e.x - center.x)
                let dy = Math.sign(e.y - center.y)
                if (dx === 0 && dy === 0) dx = 1   // dead-center: shove a default way
                knockback(e, dx, dy, push)
            },
        })
    }
}
