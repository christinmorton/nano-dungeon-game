import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import levitate from '../../tags/levitate.js'
import { playCast } from '../../Animations.js'
import { quickened, bump, efficient } from '../../abilities/traitDefs.js'

// Wind utility / world-interaction — rise off the ground for a few turns: while
// aloft you FLOAT over ground hazards, traps, and hazard zones unharmed (the
// on-step hazard trigger is skipped while Levitate is held — see
// Hazards.triggerHazardsAt). Cross a burning field, a mire, or caltrops safely.
// Self-buff; gives the Levitate tag its first applier. Library/unslotted.

const WIND_TINT = 0xcfe8ff

export default class Levitate extends Ability {
    name = 'Levitate'
    icon = 31
    description = 'Rise off the ground for a few turns — float over hazards, traps, and hazard zones unharmed. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    fxColor = WIND_TINT
    floatTurns = 4

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.floatTurns += 1 },
    }

    augments = {
        sustained:  { label: 'Sustained', apply: a => { a.floatTurns += 3 } },
        rapid:      { label: 'Rapid', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
        effortless: { label: 'Effortless', apply: a => { a.cost = { ...a.cost, ap: 0 } } },
    }

    traits = {
        lasting:   bump('Lasting', 'floatTurns', 2),
        quickened: quickened(1),
        efficient: efficient({ ap: 1 }),
    }

    activate(hero) {
        hero.addTag(levitate, this.floatTurns)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name} rises into the air.`)
        return true
    }
}
