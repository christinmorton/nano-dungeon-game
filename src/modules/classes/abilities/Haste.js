import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { buffAura } from '../../abilities/patterns.js'
import haste from '../../tags/haste.js'
import { quickened, efficient, bump } from '../../abilities/traitDefs.js'

// Time tree — the haste buff: grant extra movement each turn for a few turns to
// yourself OR an ally (the Time caster's tempo gift). Reassigned out of Wind into
// the new Time tree (user 2026-06-24). Haste applied with explicit params so the
// ladder can scale the bonus/duration; Mass augment buffs the whole party.
// Library/unslotted.

const TIME_TINT = 0x7fd4ff

export default class Haste extends Ability {
    name = 'Haste'
    icon = 31
    description = 'Grant Haste (extra movement each turn) for 3 turns to yourself or an ally (range 5). 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'pickAlly'
    fxColor = TIME_TINT
    radius = 2                 // Mass augment aura radius

    hasteTurns = 3
    hasteBonus = 2
    mass = false               // augment: haste the whole party

    // --- Progression ladder ----------------------------------------------------
    //   L1 : +2 MP/turn for 3 turns, single ally
    //   L2 : +1 haste bonus                                                [boost]
    //   L3 : augment — Greater (+bonus) | Enduring (+turns) | Mass Haste (party aura)
    //   L4 : a trait slot — Fleeting (+bonus) | Quickened | Efficient
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.hasteBonus += 1 },
    }

    augments = {
        greater:  { label: 'Greater',    apply: a => { a.hasteBonus += 1 } },
        enduring: { label: 'Enduring',   apply: a => { a.hasteTurns += 3 } },
        mass:     { label: 'Mass Haste', apply: a => { a.mass = true } },
    }

    traits = {
        fleeting:  bump('Fleeting', 'hasteBonus', 1),
        quickened: quickened(2),
        efficient: efficient({ ap: 1 }),
    }

    activate(hero, target) {
        if (this.mass) {
            const count = buffAura(this, hero, { statuses: haste, castType: 'arcane' })
            gameLog.log(count ? `${hero.name} hastes the party (${count}).` : `${hero.name} bends time.`)
            return true
        }
        const ally = target?.entity ?? hero
        ally.addTag(haste, this.hasteTurns, this.hasteBonus)
        playCast(ally, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name} hastes ${ally.name} (+${this.hasteBonus} MP/turn).`)
        return true
    }
}
