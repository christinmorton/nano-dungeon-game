import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import innerFlame from '../../tags/innerFlame.js'
import { playCast } from '../../Animations.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Fire buff — stoke your inner flame: a strong, short burst of +magicPower (the
// new Inner Flame tag). The Fire tree's power steroid — bigger and briefer than
// the arcane Manaweave, rewarding "go loud" timing before a nova or Pyre Mark
// detonation. Self-buff, library/unslotted.

const FIRE_TINT = 0xff7733

export default class InnerFlame extends Ability {
    name = 'Inner Flame'
    icon = 31
    description = 'Stoke your inner flame: a strong, short burst of magic power. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    fxColor = FIRE_TINT

    innerFlameTurns = 3
    innerFlameBonus = 6        // +magicPower while held (burst — stronger/shorter than Manaweave)

    // --- Progression ladder ----------------------------------------------------
    //   L1 : +6 magic, 3 turns
    //   L2 : +8 magic                                                      [boost]
    //   L3 : augment — Roaring Flame (+magic) | Lasting Flame (+turns) | Rapid Kindle (cd -2)
    //   L4 : a trait slot — Mighty (+magic) | Lasting (+turns) | Quickened (cd -1)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.innerFlameBonus += 2 },
    }

    augments = {
        roaring: { label: 'Roaring Flame', apply: a => { a.innerFlameBonus += 4 } },
        lasting: { label: 'Lasting Flame', apply: a => { a.innerFlameTurns += 2 } },
        rapid:   { label: 'Rapid Kindle', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        mighty:    bump('Mighty', 'innerFlameBonus', 3),
        lasting:   bump('Lasting', 'innerFlameTurns', 2),
        quickened: quickened(1),
    }

    activate(hero) {
        hero.addTag(innerFlame, this.innerFlameTurns, this.innerFlameBonus)
        playCast(hero, { type: 'fire', tint: this.fxColor })
        gameLog.log(`${hero.name} stokes an inner flame.`)
        return true
    }
}
