import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import manaweave from '../../tags/manaweave.js'
import { playCast } from '../../Animations.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Arcane buff — the caster's power steroid: +magicPower for a few turns (the
// Manaweave tag; magicPower scales every spell's damage via rollDamage, so this
// empowers the whole Arcane kit while held). The magicPower analog of the Elf's
// Hunter's Focus. Self-buff, library/unslotted.

export default class Manaweave extends Ability {
    name = 'Manaweave'
    icon = 31
    description = 'Weave the mana: raise magic power for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'

    fxColor = 0xc084fc          // arcane violet

    manaweaveTurns = 4
    manaweaveBonus = 4          // +magicPower while held

    // --- Progression ladder ----------------------------------------------------
    //   L1 : +4 magic, 4 turns
    //   L2 : +5 magic                                                      [boost]
    //   L3 : augment — Deep Weave (+3 turns) | Potent Weave (+4 magic) | Rapid Weave (cd -2)
    //   L4 : a trait slot — Lasting (+turns) | Mighty (+magic) | Quickened (cd -1)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.manaweaveBonus += 1 },
    }

    augments = {
        deep:   { label: 'Deep Weave', apply: a => { a.manaweaveTurns += 3 } },
        potent: { label: 'Potent Weave', apply: a => { a.manaweaveBonus += 4 } },
        rapid:  { label: 'Rapid Weave', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        lasting:   bump('Lasting', 'manaweaveTurns', 2),
        mighty:    bump('Mighty', 'manaweaveBonus', 3),
        quickened: quickened(1),
    }

    activate(hero) {
        hero.addTag(manaweave, this.manaweaveTurns, this.manaweaveBonus)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name} weaves the mana.`)
        return true
    }
}
