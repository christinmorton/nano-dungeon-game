import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Time tree — wind back the clock on your own spells: knock the cooldowns down on
// all your OTHER abilities, letting you re-cast a big spell sooner. Pure tempo
// utility (no Haste — that's Haste's job; this is the "Hasten Cooldowns" idea).
// Reuses the cooldown-cut loop proven by the Elf's Quickdraw. Self-buff,
// library/unslotted.

const TIME_TINT = 0x7fd4ff

export default class Quicken extends Ability {
    name = 'Quicken'
    icon = 31
    description = "Wind back time on your other abilities — reduce all their cooldowns. 1 AP, cd 7."
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 0
    target = 'self'
    fxColor = TIME_TINT

    cooldownCut = 2            // turns shaved off every OTHER ability
    fullReset = false         // augment: zero them instead

    // --- Progression ladder ----------------------------------------------------
    //   L1 : -2 cooldowns on all other abilities
    //   L2 : -3 cooldowns                                                  [boost]
    //   L3 : augment — Greater (+cut) | Total Reset (zero all) | Echo (+cut, self cd -1)
    //   L4 : a trait slot — Surge (+cut) | Quickened (self cd) | Greater (+cut)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.cooldownCut += 1 },
    }

    augments = {
        greater:    { label: 'Greater',     apply: a => { a.cooldownCut += 3 } },
        totalReset: { label: 'Total Reset', apply: a => { a.fullReset = true } },
        echo:       { label: 'Echo',        apply: a => { a.cooldownCut += 2; a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        surge:     bump('Surge', 'cooldownCut', 2),
        quickened: quickened(2),
        greater:   bump('Greater', 'cooldownCut', 2),
    }

    activate(hero) {
        let freed = 0
        for (const a of hero.abilities || []) {
            if (!a || a === this) continue   // bar may be sparse (Ultimate-slot gap)
            const before = a.cooldownRemaining || 0
            if (before <= 0) continue
            a.cooldownRemaining = this.fullReset ? 0 : Math.max(0, before - this.cooldownCut)
            freed += before - a.cooldownRemaining
        }
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        hero.hud?.refresh?.()
        gameLog.log(freed
            ? `${hero.name} winds back time — spells ready sooner.`
            : `${hero.name} winds back time.`)
        return true
    }
}
