import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import evasion from '../../tags/evasion.js'
import { playCast } from '../../Animations.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Wind defense — wreathe yourself in buffeting wind: a strong DODGE spike for a few
// turns, so attacks (especially arrows) are swept aside rather than soaked. The
// Wind tree's avoidance defense — reuses the Evasion primitive, wind-flavored (the
// "same primitive, reflavored per element" move). Self-buff, library/unslotted.
// (A ranged-SPECIFIC deflect is a future refinement; for now it's a big all-types
// dodge that reads as wind buffeting attacks aside.)

const WIND_TINT = 0xcfe8ff

export default class WindWard extends Ability {
    name = 'Wind Ward'
    icon = 31
    description = 'Wreathe yourself in buffeting wind: a strong dodge spike for a few turns — attacks (especially arrows) are swept aside. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    fxColor = WIND_TINT

    wardTurns = 3
    wardDodge = 10            // strong dodge (wind deflection)

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.wardDodge += 2 },
    }

    augments = {
        gale:    { label: 'Gale Shield', apply: a => { a.wardDodge += 4 } },
        lasting: { label: 'Lasting', apply: a => { a.wardTurns += 2 } },
        rapid:   { label: 'Rapid', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        evasive:   bump('Evasive', 'wardDodge', 3),
        lasting:   bump('Lasting', 'wardTurns', 2),
        quickened: quickened(1),
    }

    activate(hero) {
        hero.addTag(evasion, this.wardTurns, this.wardDodge)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name} is wreathed in buffeting wind.`)
        return true
    }
}
