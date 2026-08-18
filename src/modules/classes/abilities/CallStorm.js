import Ability from './Ability.js'
import { volley } from '../../abilities/patterns.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// Storm `spirit` (shaman) — commune with the storm and call it down over an area:
// lightning strikes EVERY tile of a clicked circle (range 6) for heavy magic
// damage. The tree's bombardment ultimate. Delivery = patterns.volley (tiles
// mode over the circle shape). Soft-gated by Magic (§14 B1): casters (Shaman/Wizard
// start Magic 15) cast it natively; others can earn it by investing in Magic.
// Library/unslotted.

const STORM_TINT = 0x88ccff

export default class CallStorm extends Ability {
    name = 'Call Storm'
    icon = 31
    description = 'Commune with the storm: call lightning down on every tile of a clicked area (range 6) for magicPower + 4..7 each. Needs Magic 15. 1 AP, cd 8.'
    cost = { ap: 1, mp: 0 }
    cooldown = 8
    range = 6
    target = 'aoeTile'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    requires = { Magic: 15 }            // soft spirit/commune gate (§14 B1)
    fxColor = STORM_TINT

    damageMin = 4
    damageMax = 7
    damageStat = 'magicPower'
    damageType = 'magic'

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 area, magicPower + 4..7 per tile
    //   L2 : +2/+2 damage                                                  [boost]
    //   L3 : augment — Wide Storm (+radius) | Overcharged (+dmg) | Rapid Call (cd -2)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 2; a.damageMax += 2 },
    }

    augments = {
        wide:        { label: 'Wide Storm', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        overcharged: { label: 'Overcharged', apply: a => { a.damageMin += 4; a.damageMax += 5 } },
        rapid:       { label: 'Rapid Call', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        empowered: empowered(3),
        enlarge:   { label: 'Enlarge', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        quickened: quickened(1),
    }

    activate(hero, target) {
        return volley(this, hero, {
            mode: 'tiles',
            origin: target.tile,
            projectile: { attackTile: 7, tint: STORM_TINT },
        })
    }
}
