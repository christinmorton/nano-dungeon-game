import Ability from './Ability.js'
import { bolt } from '../../abilities/patterns.js'
import blight from '../../tags/blight.js'
import { empowered, reaching, quickened } from '../../abilities/traitDefs.js'

// Void tree — hurl necrotic blight at an enemy: modest magic damage plus Blight,
// a slow dark DoT. Gives Blight its first applier. Delivery = patterns.bolt; the
// Blight rider is applied explicitly in onImpact so the ladder can scale its
// per-turn damage and duration. Library/unslotted (Void).

const BLIGHT_TINT = 0x6b8e23
const BLIGHT_PROJECTILE_TILE = 567

export default class BlightBolt extends Ability {
    name = 'Blight Bolt'
    icon = 31
    description = 'Hurl blight at an enemy (range 5): magicPower + 1..3 damage and Blight (2/turn for 5 turns). 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 5
    target = 'pickEnemy'
    fxColor = BLIGHT_TINT

    damageMin = 1
    damageMax = 3
    damageStat = 'magicPower'
    damageType = 'magic'

    blightDamage = 2
    blightTurns = 5

    // --- Progression ladder ----------------------------------------------------
    //   L1 : magic+1..3 · Blight 2/turn x5
    //   L2 : +1 blight/turn                                                [boost]
    //   L3 : augment — Virulent (+blight) | Caustic (+impact) | Debilitating (longer)
    //   L4 : a trait slot — Empowered | Reaching | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.blightDamage += 1 },
    }

    augments = {
        virulent:     { label: 'Virulent',     apply: a => { a.blightDamage += 2 } },
        caustic:      { label: 'Caustic',      apply: a => { a.damageMin += 4; a.damageMax += 6 } },
        debilitating: { label: 'Debilitating', apply: a => { a.blightTurns += 4 } },
    }

    traits = {
        empowered: empowered(3),
        reaching:  reaching(2),
        quickened: quickened(1),
    }

    activate(hero, target) {
        bolt(this, hero, target.entity, {
            castType: 'arcane',
            projectile: { attackTile: BLIGHT_PROJECTILE_TILE, tint: BLIGHT_TINT },
            onImpact: (v, result) => {
                if (!result.killed) v.addTag(blight, this.blightDamage, this.blightTurns)
            },
        })
    }
}
