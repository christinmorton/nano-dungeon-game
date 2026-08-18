import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import bleed from '../../tags/bleed.js'
import slow from '../../tags/slow.js'
import { throwShape, applyThrowEmpowerments } from '../../abilities/throwing.js'
import { addStatus, bump } from '../../abilities/traitDefs.js'

// Blade Storm Strike — an AoE entry in the THROWING combat style: spray a cone of
// knives, hitting every enemy in front. Same gear-gating as Throw Knives
// (improvised flat vs throwable-equipped attackPower scaling + the weapon's roll
// + its flavor), at a lower per-hit scale since it sprays many. Delivered via the
// shared throwShape (shapeStrike footprint).
export default class BladeStormStrike extends Ability {
    name = 'Blade Storm Strike'
    icon = 31
    description = 'Fling a cone of knives, hitting every enemy in front. Weak with a non-throwing weapon; equip throwing knives to spray hard. 1 AP, cd 3.'
    cost = { ap: 1, mp: 0 }
    cooldown = 3
    range = 3
    target = 'direction'
    damageType = 'physical'

    shape = { kind: 'cone', length: 3, spread: 1 }
    projectileScale = 0.5

    // Gear-gated AoE: lower per-hit scale than single-target (hits many).
    armedScale = 0.25
    unarmedMin = 1
    unarmedMax = 3
    appliesStatus = null

    // --- Progression ladder ----------------------------------------------------
    //   L1 : cone length 3 / spread 1
    //   L2 : +1 length                                               [boost]
    //   L3 : augment — Wide (+spread) | Serrated (+bleed) | Keen (+scaling)
    //   L4 : a trait slot (Reaching (+length) | Rending (+bleed) | Pinning (+slow))
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.shape = { ...a.shape, length: a.shape.length + 1 } },
    }

    augments = {
        wide:     { label: 'Wide', apply: a => { a.shape = { ...a.shape, spread: a.shape.spread + 1 } } },
        serrated: addStatus('Serrated', bleed),
        keen:     bump('Keen', 'armedScale', 0.1),
    }

    traits = {
        reaching: { label: 'Reaching', apply: a => { a.shape = { ...a.shape, length: a.shape.length + 1 } } },
        rending:  addStatus('Rending', bleed),
        pinning:  addStatus('Pinning', slow),
    }

    applyEmpowerments() { applyThrowEmpowerments(this) }

    activate(hero, target) {
        this.rebuild()   // refresh empowerments + ladder before throwShape injects damage
        const weapon = throwShape(this, hero, target.dx, target.dy, { tint: 0xd0d0d0 })
        gameLog.log(`${hero.name} looses a storm of blades${weapon ? '' : ' (improvised)'}.`)
    }
}
