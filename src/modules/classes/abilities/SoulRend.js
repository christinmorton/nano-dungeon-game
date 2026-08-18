import Ability from './Ability.js'
import { drainStrike } from '../../abilities/patterns.js'
import cursed from '../../tags/cursed.js'
import { empowered, reaching, quickened } from '../../abilities/traitDefs.js'

// DEMONIC tree (§6.8, apex void) — Soul Rend. Tear at a single enemy's spirit:
// heavy void damage that DRAINS life back to you (drainStrike), and leaves the
// victim Cursed. The demon's sustain — out-attrition anything by feeding on it.
// Higher-tier (gated). Delivery = patterns.drainStrike + a curse rider.
// Library/unslotted.

const VOID_TINT = 0x8a1f4a

export default class SoulRend extends Ability {
    name = 'Soul Rend'
    icon = 31
    description = 'Rend an enemy’s soul (range 6): magicPower + 16..24 void damage, healing you for half, and leaves them Cursed. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 6
    target = 'pickEnemy'
    fxColor = VOID_TINT
    requires = { Magic: 30 }

    damageMin = 16
    damageMax = 24
    damageStat = 'magicPower'
    damageType = 'magic'
    appliesStatus = cursed

    drainRatio = 0.5

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = { 2: a => { a.damageMin += 5; a.damageMax += 5 } }

    augments = {
        greater:  { label: 'Greater Rend', apply: a => { a.damageMin += 10; a.damageMax += 12 } },
        vampiric: { label: 'Vampiric', apply: a => { a.drainRatio = 0.75 } },
        reaching: reaching(2),
    }

    traits = {
        empowered: empowered(6),
        quickened: quickened(1),
        vampiric:  { label: 'Insatiable', apply: a => { a.drainRatio += 0.15 } },
    }

    activate(hero, target) {
        return drainStrike(this, hero, target.entity, {
            resource: 'hp',
            ratio: this.drainRatio,
            castType: 'arcane',
        })
    }
}
