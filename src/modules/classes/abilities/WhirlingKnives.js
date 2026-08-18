import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import bleed from '../../tags/bleed.js'
import slow from '../../tags/slow.js'
import { throwNova, applyThrowEmpowerments } from '../../abilities/throwing.js'
import { addStatus, bump } from '../../abilities/traitDefs.js'

// Whirling Knives — the THROWING style's nova: spin and hurl knives in all
// directions, hitting every enemy around you. Same gear-gating as Throw Knives
// (improvised vs throwable-equipped + the weapon's roll + its flavor), at a lower
// per-hit scale. Delivered via the shared throwNova (the shockwave verb).
export default class WhirlingKnives extends Ability {
    name = 'Whirling Knives'
    icon = 31
    description = 'Spin and hurl knives in all directions, hitting every enemy around you. Weak with a non-throwing weapon; equip throwing knives to cut deep. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 2
    target = 'self'
    damageType = 'physical'

    radius = 1.5
    // Gear-gated AoE: lower per-hit scale than single-target (hits many).
    armedScale = 0.25
    unarmedMin = 1
    unarmedMax = 3
    appliesStatus = null

    // --- Progression ladder ----------------------------------------------------
    //   L1 : radius 1.5 (all adjacent)
    //   L2 : +1 radius                                               [boost]
    //   L3 : augment — Sweeping (+radius) | Serrated (+bleed) | Keen (+scaling)
    //   L4 : a trait slot (Wide (+radius) | Rending (+bleed) | Pinning (+slow))
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1 },
    }

    augments = {
        sweeping: { label: 'Sweeping', apply: a => { a.radius += 1 } },
        serrated: addStatus('Serrated', bleed),
        keen:     bump('Keen', 'armedScale', 0.1),
    }

    traits = {
        wide:    { label: 'Wide', apply: a => { a.radius += 0.5 } },
        rending: addStatus('Rending', bleed),
        pinning: addStatus('Pinning', slow),
    }

    applyEmpowerments() { applyThrowEmpowerments(this) }

    activate(hero, target) {
        this.rebuild()   // refresh empowerments + ladder
        const { weapon, hits } = throwNova(this, hero, { fxColor: 0xd0d0d0 })
        gameLog.log(hits.length
            ? `${hero.name} whirls a storm of knives, hitting ${hits.length}${weapon ? '' : ' (improvised)'}.`
            : `${hero.name} whirls a storm of knives${weapon ? '' : ' (improvised)'}.`)
    }
}
