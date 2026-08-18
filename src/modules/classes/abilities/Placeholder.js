import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import statusList from '../../tags/statusList.js'

// Status tester (formerly the verify-the-loop Placeholder). Each cast
// applies the NEXT status in the full catalog to the hero, cycling through
// every one — including the parked statuses that have no real applier yet
// — so they can be observed in-game. Self-target; the cursor is module-
// level so it advances across casts and across any class slot it sits in.
//
// NOTE: applying these to yourself behaves exactly as designed. Freeze /
// Stun / Sleep / Petrify zero your MP/AP for their duration (you'll skip
// turns until they lift), and Doom kills you when its timer runs out.

let cursor = 0

export default class Placeholder extends Ability {
    name = 'Status Test'
    icon = 31
    description = 'Debug: each cast applies the next status in the catalog to you. 1 AP, no cooldown.'
    cost = { ap: 1, mp: 0 }
    cooldown = 0
    range = 0
    target = 'self'

    activate(hero, target) {
        const status = statusList[cursor % statusList.length]
        const position = (cursor % statusList.length) + 1
        cursor += 1
        hero.addTag(status)
        gameLog.log(`Status Test: applied ${status.name} (${position}/${statusList.length}).`)
    }
}
