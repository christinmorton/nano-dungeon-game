import Ability from './Ability.js'
import { areaStrike } from '../../abilities/patterns.js'
import slow from '../../tags/slow.js'
import stun from '../../tags/stun.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// FUSION (Storm + Ice) — Hailstorm. A barrage of jagged ice from the sky: physical
// impact damage to all in the area, Slowed by the ice, and a chance for a heavy
// stone of hail to STUN (Storm's concussive jolt). Storm's bombardment fused with
// Ice's chill — damage + soft lockdown. ADVANCED / higher-tier. Delivery =
// areaStrike (circle) + a per-enemy stun roll. Library/unslotted.

const HAIL_TINT = 0xbfe6ff

export default class Hailstorm extends Ability {
    name = 'Hailstorm'
    icon = 31
    description = 'Hammer an area with hail (range 6): magicPower + 7..12 damage, Slow all caught, and ~35% chance to Stun each. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 6
    target = 'aoeTile'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = HAIL_TINT
    requires = { Magic: 14 }

    damageMin = 7
    damageMax = 12
    damageStat = 'magicPower'
    damageType = 'physical'
    appliesStatus = slow

    stunChance = 0.35

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 · 7..12 · Slow · 35% Stun
    //   L2 : +1 radius                                                     [boost]
    //   L3 : augment — Squall (+radius) | Heavy Stones (+damage) | Concussive (+stun chance)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1; a.shape.radius += 1 },
    }

    augments = {
        squall:     { label: 'Squall', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        heavy:      { label: 'Heavy Stones', apply: a => { a.damageMin += 4; a.damageMax += 6 } },
        concussive: { label: 'Concussive', apply: a => { a.stunChance += 0.2 } },
    }

    traits = {
        empowered: empowered(4),
        enlarge:   { label: 'Enlarge', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        quickened: quickened(1),
    }

    activate(hero, target) {
        const results = areaStrike(this, hero, target.tile, { splash: true })
        for (const { entity, result } of results) {
            if (result.killed || !entity.sprite) continue
            if (Math.random() < this.stunChance) entity.addTag(stun)
        }
        return results
    }
}
