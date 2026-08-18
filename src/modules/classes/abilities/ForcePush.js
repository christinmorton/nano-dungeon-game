import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { displace } from '../../abilities/patterns.js'
import { reaching, quickened, bump } from '../../abilities/traitDefs.js'

// Wind utility — a hard blast of wind shoves a picked enemy straight back. Pure
// displacement: knock a charger off you, push a foe into a hazard / off a ledge,
// or open space to kite. Delivery = patterns.displace (push). Display name "Gale"
// (locked rename ←Force Push); class stays ForcePush to avoid registry churn.

const WIND_TINT = 0xcfe8ff

export default class ForcePush extends Ability {
    name = 'Gale'
    icon = 31
    description = 'A blast of wind shoves a picked enemy 2 tiles back (range 4). 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 4
    target = 'pickEnemy'
    fxColor = WIND_TINT
    pushDist = 2

    // --- Progression ladder ----------------------------------------------------
    //   L3 augment — Strong Gust (+push) | Far Reach (+range) | Rapid (cd -1)
    //   L4 trait — Forceful (+push) | Reaching | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.pushDist += 1 },
    }

    augments = {
        strong:   { label: 'Strong Gust', apply: a => { a.pushDist += 2 } },
        farReach: { label: 'Far Reach', apply: a => { a.range += 3 } },
        rapid:    { label: 'Rapid', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        forceful:  bump('Forceful', 'pushDist', 1),
        reaching:  reaching(2),
        quickened: quickened(1),
    }

    activate(hero, target) {
        const victim = target.entity
        if (victim.x === hero.x && victim.y === hero.y) {
            gameLog.log(`Can't push something standing on top of you.`)
            return false
        }
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        displace(this, hero, victim, { distance: this.pushDist, mode: 'push' })
        return true
    }
}
