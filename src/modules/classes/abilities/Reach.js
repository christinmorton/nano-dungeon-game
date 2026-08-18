import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import extendedReach from '../../tags/extendedReach.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Spatial tree — ENCHANT REACH: fold space around your melee weapon so it strikes
// from further away (Extended Reach buff → +melee attack range for a few turns).
// A sword that normally reaches 2 tiles can strike at 3+, a spear (base 3) reaches
// further still. The Spatial caster's signature melee-support enchant — a wizard
// blade-dancer or a fighter who dabbles in spatial magic. Self-target buff.
// Library/unslotted (Spatial; Arcane is the natural caster per the lore tie).
//
// PARKED (see encyclopedia melee-enchant capture): a PERMANENT-for-the-run version
// (needs the weapon-affix consumer) · an enchant-STATUE special room · per-
// weaponCategory scaling (spear/long weapons gain more). This is the temporary
// timed form.

const SPATIAL_TINT = 0xc0a0ff

export default class Reach extends Ability {
    name = 'Reach'
    icon = 31
    description = 'Fold space around your melee weapon — +1 attack range for 5 turns (a sword reaches 3, a spear further). 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    fxColor = SPATIAL_TINT

    reachBonus = 1            // tiles added to melee range
    reachTurns = 5

    // --- Progression ladder ----------------------------------------------------
    //   L1 : +1 melee range, 5 turns
    //   L2 : +2 turns                                                      [boost]
    //   L3 : augment — Far Reach (+1 range) | Lasting (long duration) | Honed (cd -2)
    //   L4 : a trait slot — Greater (+range) | Enduring (+turns) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.reachTurns += 2 },
    }

    augments = {
        farReach: { label: 'Far Reach', apply: a => { a.reachBonus += 1 } },
        lasting:  { label: 'Lasting',   apply: a => { a.reachTurns += 10 } },   // near run-long stand-in
        honed:    { label: 'Honed',     apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        greater:   bump('Greater', 'reachBonus', 1),
        enduring:  bump('Enduring', 'reachTurns', 3),
        quickened: quickened(1),
    }

    activate(hero) {
        hero.addTag(extendedReach, this.reachTurns, this.reachBonus)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name} folds space around their blade (+${this.reachBonus} reach).`)
        return true
    }
}
