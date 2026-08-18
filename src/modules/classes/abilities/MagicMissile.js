import Ability from './Ability.js'
import { bolt } from '../../abilities/patterns.js'
import { empowered, quickened, reaching } from '../../abilities/traitDefs.js'

// Arcane pool ability — a reliable arcane bolt: pure magicPower-scaled damage,
// no status, short cooldown. The caster's bread-and-butter filler. Delivery =
// patterns.bolt (declarative fields drive damage via dealHit). Library/unslotted.
// Display name "Mana Missile" (the single-shot half of the Mana family; the
// salvo is Mana Darts). Class kept MagicMissile to avoid registry churn.

const ARCANE_TINT = 0xc084fc
const ARCANE_PROJECTILE_TILE = 567

export default class MagicMissile extends Ability {
    name = 'Mana Missile'
    icon = 31
    description = 'A reliable arcane bolt at an enemy (range 5): magicPower + 2..4 damage. 1 AP, cd 2.'
    cost = { ap: 1, mp: 0 }
    cooldown = 2
    range = 5
    target = 'pickEnemy'

    // Declarative payload — bolt() reads these via dealHit. A pure bolt (no
    // status); fxColor is the single color knob (cast pulse + projectile).
    damageMin = 2
    damageMax = 4
    damageStat = 'magicPower'
    damageType = 'magic'
    fxColor = ARCANE_TINT

    // --- Progression ladder ----------------------------------------------------
    //   L1 : magicPower + 2..4
    //   L2 : +1/+2 damage                                                  [boost]
    //   L3 : augment — Overcharged (+dmg) | Rapid Cast (cd -1) | Far Reach (+range)
    //   L4 : a trait slot — Empowered | Quickened | Reaching
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 1; a.damageMax += 2 },
    }

    augments = {
        overcharged: { label: 'Overcharged', apply: a => { a.damageMin += 3; a.damageMax += 5 } },
        rapid:       { label: 'Rapid Cast', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
        farReach:    { label: 'Far Reach', apply: a => { a.range += 3 } },
    }

    traits = {
        empowered: empowered(2),
        quickened: quickened(1),
        reaching:  reaching(2),
    }

    activate(hero, target) {
        bolt(this, hero, target.entity, {
            castType: 'arcane',
            projectile: { attackTile: ARCANE_PROJECTILE_TILE, tint: ARCANE_TINT },
        })
    }
}
