import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import stoneskin from '../../tags/stoneskin.js'
import { playCast } from '../../Animations.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Earth defense — turn your hide to stone: a big flat +armor for a few turns (the
// Stoneskin tag; reduces physical damage via the armor stat). The Earth tree's
// mitigation defense — stack it with Barrier (resist) or a shield for a wall of a
// caster. Self-buff, library/unslotted.

const EARTH_TINT = 0x9a8b6f

export default class Stoneskin extends Ability {
    name = 'Stoneskin'
    icon = 31
    description = 'Turn your skin to stone: a big +armor for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    fxColor = EARTH_TINT

    stoneTurns = 4
    stoneBonus = 8             // +armor while held

    // --- Progression ladder ----------------------------------------------------
    //   L1 : +8 armor, 4 turns
    //   L2 : +10 armor                                                     [boost]
    //   L3 : augment — Granite (+armor) | Enduring (+turns) | Rapid (cd -2)
    //   L4 : a trait slot — Hardened (+armor) | Lasting (+turns) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.stoneBonus += 2 },
    }

    augments = {
        granite:  { label: 'Granite', apply: a => { a.stoneBonus += 4 } },
        enduring: { label: 'Enduring', apply: a => { a.stoneTurns += 2 } },
        rapid:    { label: 'Rapid Set', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        hardened:  bump('Hardened', 'stoneBonus', 3),
        lasting:   bump('Lasting', 'stoneTurns', 2),
        quickened: quickened(1),
    }

    activate(hero) {
        hero.addTag(stoneskin, this.stoneTurns, this.stoneBonus)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name}'s skin hardens to stone.`)
        return true
    }
}
