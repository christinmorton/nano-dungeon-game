import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { supportAlly } from '../../abilities/patterns.js'
import { bump, quickened } from '../../abilities/traitDefs.js'

// Aegis — the Cleric's protective shield: grant a depletable absorb pool (the
// Shield tag, spent before HP) to yourself OR an ally via supportAlly. The
// holy/support counterpart to the martial self-only Shield Wall — a Cleric tops up
// a frontliner's buffer instead of only their own. Scales with magicPower.
// Unslotted — the holy Defense slot (encyclopedia §4 Holy).
export default class Aegis extends Ability {
    name = 'Aegis'
    icon = 31
    description = 'Wrap yourself or an ally in a holy aegis that absorbs damage (scales with magic, range 5). 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 5
    target = 'pickAlly'

    fxColor = 0xffe39a          // holy gold

    shieldBase = 10            // + magicPower at cast

    // --- Progression ladder -----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.shieldBase += 4 },
    }

    augments = {
        greater:   bump('Greater', 'shieldBase', 6),
        quickened: quickened(2),
    }

    traits = {
        radiant: bump('Radiant', 'shieldBase', 5),
    }

    activate(hero, target) {
        const ally = target?.entity ?? null
        const amount = this.shieldBase + hero.stat('magicPower')
        const did = supportAlly(this, hero, ally, { shieldAmount: amount })
        gameLog.log(`${hero.name} wraps ${(ally ?? hero).name} in a holy aegis (${amount}).`)
        return did
    }
}
