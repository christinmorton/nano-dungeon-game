import Ability from './Ability.js'
import { areaStrike } from '../../abilities/patterns.js'
import { knockback } from '../../abilities/universals.js'
import burning from '../../tags/burning.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// FUSION (Fire + Wind) — Firestorm. A roaring vortex of flame: big fire damage +
// Burning to every enemy in the area, and the gale at its heart HURLS them
// outward from the blast (Wind's knockback). Fire's burst fused with Wind's
// displacement — damage + scatter. ADVANCED / higher-tier. Delivery =
// patterns.areaStrike (circle) + a center-out knockback rider. Library/unslotted.

const FIRE_TINT = 0xff7733

export default class Firestorm extends Ability {
    name = 'Firestorm'
    icon = 31
    description = 'Conjure a vortex of flame on an area (range 6): magicPower + 9..15 fire damage + Burning, and hurl every enemy outward. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 6
    target = 'aoeTile'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = FIRE_TINT
    requires = { Magic: 14 }

    damageMin = 9
    damageMax = 15
    damageStat = 'magicPower'
    damageType = 'fire'
    appliesStatus = burning

    pushDistance = 2

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 · fire+9..15 + Burning · hurl 2 tiles
    //   L2 : +1 radius                                                     [boost]
    //   L3 : augment — Cyclone (+radius) | Conflagration (+damage) | Gale Force (+push)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1; a.shape.radius += 1 },
    }

    augments = {
        cyclone:       { label: 'Cyclone', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        conflagration: { label: 'Conflagration', apply: a => { a.damageMin += 5; a.damageMax += 7 } },
        galeForce:     { label: 'Gale Force', apply: a => { a.pushDistance += 2 } },
    }

    traits = {
        empowered: empowered(4),
        enlarge:   { label: 'Enlarge', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        quickened: quickened(1),
    }

    activate(hero, target) {
        const center = target.tile
        const results = areaStrike(this, hero, center, { splash: true })
        for (const { entity, result } of results) {
            if (result.killed || !entity.sprite) continue
            let dx = Math.sign(entity.x - center.x)
            let dy = Math.sign(entity.y - center.y)
            if (dx === 0 && dy === 0) dx = 1   // dead-center: shove a default way
            knockback(entity, dx, dy, this.pushDistance)
        }
        return results
    }
}
