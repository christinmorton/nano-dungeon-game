import Ability from './Ability.js'
import { reposition } from '../../abilities/patterns.js'
import { reaching, quickened, efficient } from '../../abilities/traitDefs.js'

// Arcane mobility — magic reposition. Pick a walkable tile within range 5; the
// caster teleports there instantly. Costs 1 AP (no MP — it's magic, not physical
// movement). Delivery = patterns.reposition ('toTile', teleport mode). Display
// name "Riftstep" (locked rename, approved). Class kept Blink to avoid churn.
//
// Soft-gated by Magic (§14 B1): casters (Wizard/Shaman start Magic 15) cast it
// natively; anyone else can earn it by investing in Magic — "difficult but not
// impossible." pickTile validates "walkable + in-range" in
// HeroController.resolveTargetedClick, and reposition re-checks walkability.

export default class Blink extends Ability {
    name = 'Riftstep'
    icon = 31
    description = 'Teleport to a picked tile within range 5. Needs Magic 15. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 5
    target = 'pickTile'
    requires = { Magic: 15 }
    fxColor = 0xc084fc

    // --- Progression ladder ----------------------------------------------------
    //   L1 : range 5, cd 4
    //   L2 : +1 range                                                      [boost]
    //   L3 : augment — Far Step (+range) | Quick Step (cd -2) | Phase (cd -1, +range)
    //   L4 : a trait slot — Reaching | Quickened | Efficient (free AP)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.range += 1 },
    }

    augments = {
        farStep:   { label: 'Far Step', apply: a => { a.range += 3 } },
        quickStep: { label: 'Quick Step', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
        phase:     { label: 'Phase', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1); a.range += 1 } },
    }

    traits = {
        reaching:  reaching(2),
        quickened: quickened(1),
        efficient: efficient({ ap: 1 }),
    }

    activate(hero, target) {
        reposition(this, hero, target, { placement: 'toTile', mode: 'teleport', castType: 'arcane' })
    }
}
