import Ability from './Ability.js'
import { areaStrike, groundZone } from '../../abilities/patterns.js'
import burning from '../../tags/burning.js'
import { enlarge, quickened, bump } from '../../abilities/traitDefs.js'

// FUSION (Fire + Earth) — Magma (Eruption). The ground splits and erupts: a burst
// of fire damage + Burning to everything in the area, then the molten rock LINGERS
// as a fire zone that sears anything standing in it each round. Fire's burn fused
// with Earth's terrain-shaping — burst + zone denial. ADVANCED / higher-tier.
// Delivery = areaStrike (the eruption) + groundZone (the magma pool). Library/
// unslotted.

const MAGMA_TINT = 0xff5522

export default class Magma extends Ability {
    name = 'Magma'
    icon = 31
    description = 'Erupt magma on an area (range 5): magicPower + 9..15 fire damage + Burning, then a lingering magma pool that sears each round. 1 AP, cd 8.'
    cost = { ap: 1, mp: 0 }
    cooldown = 8
    range = 5
    target = 'aoeTile'
    radius = 1
    shape = { kind: 'circle', radius: 1 }
    fxColor = MAGMA_TINT
    requires = { Magic: 14 }

    damageMin = 9
    damageMax = 15
    damageStat = 'magicPower'
    damageType = 'fire'
    appliesStatus = burning

    poolDuration = 4
    poolMin = 4
    poolMax = 7

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r1 eruption + magma pool (4-7/round, 4 rounds)
    //   L2 : +1 radius                                                     [boost]
    //   L3 : augment — Caldera (+radius) | Molten (+burst dmg) | Lingering (+pool turns)
    //   L4 : a trait slot — Enlarge (+radius) | Quickened | Searing (+pool dmg)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1; a.shape.radius += 1 },
    }

    augments = {
        caldera:   { label: 'Caldera', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        molten:    { label: 'Molten', apply: a => { a.damageMin += 5; a.damageMax += 7 } },
        lingering: { label: 'Lingering', apply: a => { a.poolDuration += 3 } },
    }

    traits = {
        enlarge:   enlarge(1),
        quickened: quickened(1),
        searing:   bump('Searing', 'poolMax', 3),
    }

    activate(hero, target) {
        const results = areaStrike(this, hero, target.tile, { splash: true })
        // Leave a lingering magma pool over the footprint (the Earth half).
        groundZone(this, hero, target.tiles, {
            kind: 'fire',
            duration: this.poolDuration,
            damage: { min: this.poolMin, max: this.poolMax },
            damageFlavor: 'fire',
            affects: 'enemy',
        })
        return results
    }
}
