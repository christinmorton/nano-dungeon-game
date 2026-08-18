import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import haste from '../../tags/haste.js'
import { playCast } from '../../Animations.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Elf / skirmisher — the tempo buff. Snap to action: knock down the cooldowns of
// your OTHER abilities and gain a burst of Haste, so you can chain shots and stay
// mobile. The "go loud" button. Self-buff, library/unslotted.
//
// NOTE: keeps the name "Quickdraw" (user's call). The planned Quickdraw PASSIVE
// gets renamed (e.g. Fast Hands) when the Passives batch lands.

export default class Quickdraw extends Ability {
    name = 'Quickdraw'
    icon = 31
    description = "Snap to action: reduce your other abilities' cooldowns and gain Haste. 1 AP, cd 6."
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'

    fxColor = 0xfff0a0          // quick-flash gold

    cooldownCut = 2             // turns shaved off every OTHER ability
    hasteTurns = 2
    hasteBonus = 2

    // --- Progression ladder ----------------------------------------------------
    //   L1 : -2 cooldowns + Haste 2
    //   L2 : -3 cooldowns                                                 [boost]
    //   L3 : augment — Reset (big cooldown cut) | Fleet (+Haste) | Sustained (+Haste turns)
    //   L4 : a trait slot — Quickened (self cd) | Surge (+cut) | Fleeting (+Haste)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.cooldownCut += 1 },
    }

    augments = {
        reset:     { label: 'Reset', apply: a => { a.cooldownCut += 3 } },
        fleet:     { label: 'Fleet', apply: a => { a.hasteBonus += 2 } },
        sustained: { label: 'Sustained', apply: a => { a.hasteTurns += 2 } },
    }

    traits = {
        quickened: quickened(2),
        surge:     bump('Surge', 'cooldownCut', 1),
        fleeting:  bump('Fleeting', 'hasteBonus', 1),
    }

    activate(hero) {
        for (const a of hero.abilities || []) {
            if (!a || a === this) continue   // bar may be sparse (Ultimate-slot gap)
            a.cooldownRemaining = Math.max(0, (a.cooldownRemaining || 0) - this.cooldownCut)
        }
        hero.addTag(haste, this.hasteTurns, this.hasteBonus)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        hero.hud?.refresh?.()       // reflect the freed cooldowns on the bar
        gameLog.log(`${hero.name} draws quick — weapons ready.`)
        return true
    }
}
