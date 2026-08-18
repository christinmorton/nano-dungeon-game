import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import ascended from '../../tags/ascended.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// GOD / ASCENDED tree (§6.8) — Ascend. Briefly take on a god's power: the Ascended
// buff (huge bonuses to attack, magic, ranged, and armor at once — the "infinite
// power" fantasy in lite form). The defining ability of the God tree; the full
// vision grants it permanently via an Ascension ITEM, this is the temporary
// god-mode. Entity-agnostic (any caster). Self-buff. Library/unslotted.

const GOD_TINT = 0xfff0a0

export default class Ascend extends Ability {
    name = 'Ascend'
    icon = 31
    description = 'Ascend to a god’s power for 8 turns: +30 to ALL core stats (and attack/magic/ranged/armor). 1 AP, cd 14.'
    cost = { ap: 1, mp: 0 }
    cooldown = 14
    range = 0
    target = 'self'
    fxColor = GOD_TINT
    requires = { Magic: 25 }   // the ENTRY to god-tier — Ascend then lifts you into the rest

    ascendTurns = 8
    ascendBonus = 30

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = { 2: a => { a.ascendBonus += 5 } }

    augments = {
        greater:   bump('Greater Ascension', 'ascendBonus', 10),
        enduring:  bump('Enduring', 'ascendTurns', 4),
        quickened: quickened(3),
    }

    traits = {
        exalted:   bump('Exalted', 'ascendBonus', 5),
        enduring:  bump('Enduring', 'ascendTurns', 2),
        quickened: quickened(2),
    }

    activate(hero) {
        hero.addTag(ascended, this.ascendTurns, this.ascendBonus)
        playCast(hero, { type: 'heal', tint: this.fxColor })
        gameLog.log(`${hero.name} ASCENDS!`)
        return true
    }
}
