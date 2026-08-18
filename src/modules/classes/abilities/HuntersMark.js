import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import marked from '../../tags/marked.js'
import { playCast } from '../../Animations.js'
import { reaching, bump } from '../../abilities/traitDefs.js'

// Elf / skirmisher — the kill-target debuff. Mark a foe so it takes extra damage
// from ALL sources (the Marked tag → the damageTakenMult primitive in
// resolveDamage + Combat.attack). Call your shot, then focus it down — and your
// allies benefit too. afflict on a picked enemy; no damage of its own.
// Library/unslotted.

export default class HuntersMark extends Ability {
    name = "Hunter's Mark"
    icon = 31
    description = 'Mark a foe — it takes +30% damage from all sources for a few turns. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 7
    target = 'pickEnemy'

    fxColor = 0xff5555          // hunt-red sigil

    markTurns = 4
    markFactor = 1.3            // +30% damage taken

    // --- Progression ladder ----------------------------------------------------
    //   L1 : +30% damage taken, 4 turns, range 7
    //   L2 : +35% damage taken                                           [boost]
    //   L3 : augment — Branded (+20% more) | Lingering (+3 turns) | Far Mark (+3 range)
    //   L4 : a trait slot — Reaching (range) | Lasting (+turns) | Deadly (+amp)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.markFactor += 0.05 },
    }

    augments = {
        branded:   { label: 'Branded', apply: a => { a.markFactor += 0.20 } },
        lingering: { label: 'Lingering', apply: a => { a.markTurns += 3 } },
        farMark:   { label: 'Far Mark', apply: a => { a.range += 3 } },
    }

    traits = {
        reaching: reaching(2),
        lasting:  bump('Lasting', 'markTurns', 2),
        deadly:   bump('Deadly', 'markFactor', 0.10),
    }

    activate(hero, target) {
        const victim = target.entity
        if (!victim?.sprite) return false
        victim.addTag(marked, this.markTurns, this.markFactor)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name} marks ${victim.name} for the kill.`)
        return true
    }
}
