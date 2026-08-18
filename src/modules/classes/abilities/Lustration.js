import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { cleanse, heal } from '../../abilities/universals.js'
import guarded from '../../tags/guarded.js'
import regen from '../../tags/regen.js'
import { quickened, efficient } from '../../abilities/traitDefs.js'

// Holy tree (the de-WoW rename of Cleanse) — strip every negative status
// (debuff / DoT / CC) from the caster, and mend a little in the same washing.
// The Cleric's self-cure. Self-target for now; an ally-target variant waits on a
// pickAlly targeting mode. Returns false (no cost paid) when there's nothing to
// purify AND no healing landed. Slotted (Cleric).

export default class Lustration extends Ability {
    name = 'Lustration'
    icon = 31
    description = 'Cleanse all negative status effects from yourself and restore a little HP. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    fxColor = 0xffe39a

    healBase = 4               // the cleansing waters also mend
    sanctifying = false        // augment: also grant brief Guarded
    absolving = false          // augment: also grant Regen

    // --- Progression ladder ----------------------------------------------------
    //   L1 : cleanse self + heal 4
    //   L2 : +3 healing                                                    [boost]
    //   L3 : augment — Greater (+heal) | Sanctifying (+Guarded) | Absolution (+Regen)
    //   L4 : a trait slot — Blessed (+heal) | Quickened | Efficient
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.healBase += 3 },
    }

    augments = {
        greater:     { label: 'Greater',    apply: a => { a.healBase += 5 } },
        sanctifying: { label: 'Sanctifying', apply: a => { a.sanctifying = true } },
        absolution:  { label: 'Absolution',  apply: a => { a.absolving = true } },
    }

    traits = {
        blessed:   { label: 'Blessed', apply: a => { a.healBase += 4 } },
        quickened: quickened(1),
        efficient: efficient({ ap: 1 }),
    }

    activate(hero, target) {
        const removed = cleanse(hero)
        const healed = heal(hero, this.healBase + hero.stat('magicPower'))
        if (removed.length === 0 && healed === 0 && !this.sanctifying && !this.absolving) {
            gameLog.log(`${hero.name} has nothing to purify.`)
            return false
        }
        playCast(hero, { type: 'heal' })
        if (removed.length) gameLog.log(`${hero.name}'s Lustration washes away ${removed.join(', ')}.`)
        if (this.sanctifying) hero.addTag(guarded)
        if (this.absolving) hero.addTag(regen, 3, 4)
        return true
    }
}
