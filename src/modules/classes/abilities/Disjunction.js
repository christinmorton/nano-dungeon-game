import Ability from './Ability.js'
import { drainStrike } from '../../abilities/patterns.js'
import { empowered, reaching, quickened } from '../../abilities/traitDefs.js'

// Arcane debuff — unravel an enemy's focus: light magic damage that also SAPS
// their movement points (the turn-economy / cast resource). Denial, not burst —
// strips a mover/caster's ability to act this round. Delivery =
// patterns.drainStrike with resource:'mp' (drain verb, built). Library/unslotted.

const DISJ_TINT = 0x8a7fff
const DISJ_PROJECTILE_TILE = 567

export default class Disjunction extends Ability {
    name = 'Disjunction'
    icon = 31
    description = "Unravel an enemy's focus (range 5): magicPower + 1..3 damage and saps their movement. 1 AP, cd 4."
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 5
    target = 'pickEnemy'

    damageMin = 1
    damageMax = 3
    damageStat = 'magicPower'
    damageType = 'magic'
    fxColor = DISJ_TINT

    // --- Progression ladder ----------------------------------------------------
    //   L1 : magicPower + 1..3, saps MP
    //   L2 : +1/+1 damage (more MP sapped, since drain rides damage)       [boost]
    //   L3 : augment — Overload (+dmg) | Far Unravel (+range) | Rapid Unravel (cd -1)
    //   L4 : a trait slot — Empowered | Reaching | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 1; a.damageMax += 1 },
    }

    augments = {
        overload:   { label: 'Overload', apply: a => { a.damageMin += 2; a.damageMax += 3 } },
        farUnravel: { label: 'Far Unravel', apply: a => { a.range += 2 } },
        rapid:      { label: 'Rapid Unravel', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        empowered: empowered(2),
        reaching:  reaching(2),
        quickened: quickened(1),
    }

    activate(hero, target) {
        drainStrike(this, hero, target.entity, {
            resource: 'mp',
            ratio: 1,            // MP sapped ~= damage dealt
            castType: 'arcane',
            projectile: { attackTile: DISJ_PROJECTILE_TILE, tint: DISJ_TINT },
        })
    }
}
