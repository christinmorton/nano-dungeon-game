import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { heal, cleanse } from '../../abilities/universals.js'
import regen from '../../tags/regen.js'
import { quickened, reaching } from '../../abilities/traitDefs.js'

// Holy tree — restore HP to yourself OR a party member (the heart of the survival
// kit). pickAlly tops up a wounded follower / tamed beast, not just the caster.
// Refunds when the target is already at full HP (unless a rider still applies).
// Slotted (Cleric).

export default class Heal extends Ability {
    name = 'Heal'
    icon = 31
    description = 'Restore 5 + magicPower HP to yourself or a party member (range 5). 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 5
    target = 'pickAlly'
    fxColor = 0xffe39a

    healBase = 5               // + magicPower at cast
    cleansing = false          // augment: also strip the target's debuffs
    renewing = false           // augment: also grant Regeneration

    // --- Progression ladder ----------------------------------------------------
    //   L1 : 5 + magic HP
    //   L2 : +3 healing                                                    [boost]
    //   L3 : augment — Greater (+heal) | Cleansing (also cure debuffs) | Renewing (+Regen)
    //   L4 : a trait slot — Blessed (+heal) | Quickened | Reaching
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.healBase += 3 },
    }

    augments = {
        greater:   { label: 'Greater',   apply: a => { a.healBase += 6 } },
        cleansing: { label: 'Cleansing', apply: a => { a.cleansing = true } },
        renewing:  { label: 'Renewing',  apply: a => { a.renewing = true } },   // Regen HoT (4/turn x4)
    }

    traits = {
        blessed:   { label: 'Blessed', apply: a => { a.healBase += 4 } },
        quickened: quickened(1),
        reaching:  reaching(2),
    }

    activate(hero, target) {
        const ally = target.entity || hero
        const actual = heal(ally, this.healBase + hero.stat('magicPower'))
        let did = actual > 0
        if (this.cleansing) {
            const removed = cleanse(ally)
            if (removed.length) { did = true; gameLog.log(`${ally.name} is cleansed of ${removed.join(', ')}.`) }
        }
        if (this.renewing) { ally.addTag(regen, 4, 4); did = true }   // 4 HP/turn for 4 turns
        if (!did) {
            gameLog.log(`${ally.name} is already at full health.`)
            return false
        }
        playCast(ally, { type: 'heal' })
        if (actual > 0) gameLog.log(`${hero.name} heals ${ally.name} for ${actual} HP.`)
        return true
    }
}
