import Ability from './Ability.js'
import { bolt } from '../../abilities/patterns.js'
import { empowered, reaching, quickened } from '../../abilities/traitDefs.js'

// SERAPHIM tree (§6.8, apex light) — Searing Light. A lance of pure radiance that
// scours a single target for enormous holy damage. The seraph's executioner —
// single-target burst far above the base Holy bolts. Higher-tier (heavily gated).
// Delivery = patterns.bolt. Library/unslotted.

const LIGHT_TINT = 0xffffff

export default class SearingLight extends Ability {
    name = 'Searing Light'
    icon = 31
    description = 'Scour one enemy with pure radiance (range 7): magicPower + 24..34 holy damage. Needs apex attunement. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 7
    target = 'pickEnemy'
    fxColor = LIGHT_TINT
    requires = { Magic: 35 }

    damageMin = 24
    damageMax = 34
    damageStat = 'magicPower'
    damageType = 'magic'

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = { 2: a => { a.damageMin += 6; a.damageMax += 6 } }

    augments = {
        radiant:  { label: 'Radiant', apply: a => { a.damageMin += 12; a.damageMax += 16 } },
        farLight: { label: 'Far Light', apply: a => { a.range += 3 } },
        swift:    { label: 'Swift', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        empowered: empowered(8),
        reaching:  reaching(2),
        quickened: quickened(1),
    }

    activate(hero, target) {
        bolt(this, hero, target.entity, { castType: 'heal' })
    }
}
