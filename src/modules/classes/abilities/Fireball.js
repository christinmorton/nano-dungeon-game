import Ability from './Ability.js'
import { areaStrike } from '../../abilities/patterns.js'
import burning from '../../tags/burning.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// Fire damage — the iconic lobbed fireball: hurl it at a TILE and blast a circle,
// dealing magicPower-scaled fire damage and igniting every enemy caught (Burning).
// The skillshot AOE (areaStrike at the aoeTile click), the Fire tree's bread and
// butter. (Was a single-target bolt; promoted to the AoE its name deserves.)

const FIRE_TINT = 0xff6622

export default class Fireball extends Ability {
    name = 'Fireball'
    icon = 31
    description = 'Hurl a fireball at a tile (range 5): magicPower + 3..6 damage in a blast, igniting all caught (Burning). 1 AP, cd 3.'
    cost = { ap: 1, mp: 0 }
    cooldown = 3
    range = 5
    target = 'aoeTile'
    radius = 1                              // blast preview + footprint (kept in sync with shape)
    shape = { kind: 'circle', radius: 1 }
    fxColor = FIRE_TINT

    damageMin = 3
    damageMax = 6
    damageStat = 'magicPower'
    damageType = 'magic'
    appliesStatus = burning

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r1 blast, magicPower + 3..6 + Burning
    //   L2 : +1/+2 damage                                                  [boost]
    //   L3 : augment — Big Blast (+radius) | Conflagration (+dmg) | Rapid Cast (cd -1)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 1; a.damageMax += 2 },
    }

    augments = {
        bigBlast:      { label: 'Big Blast', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        conflagration: { label: 'Conflagration', apply: a => { a.damageMin += 3; a.damageMax += 4 } },
        rapid:         { label: 'Rapid Cast', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        empowered: empowered(2),
        enlarge:   { label: 'Enlarge', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        quickened: quickened(1),
    }

    activate(hero, target) {
        return areaStrike(this, hero, target.tile, { splash: true })
    }
}
