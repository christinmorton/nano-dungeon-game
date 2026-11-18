import Ability from './Ability.js'
import { reposition } from '../../abilities/patterns.js'

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
    icon = 15
    description = 'Teleport to a picked tile within range 5. Needs Magic 15. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 5
    target = 'pickTile'
    requires = { Magic: 15 }
    fxColor = 0xc084fc

    activate(hero, target) {
        reposition(this, hero, target, { placement: 'toTile', mode: 'teleport', castType: 'arcane' })
    }
}
