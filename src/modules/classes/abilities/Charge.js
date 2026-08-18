import Ability from './Ability.js'
import stun from '../../tags/stun.js'
import slow from '../../tags/slow.js'
import { gapCloseStrike } from '../../abilities/patterns.js'
import { reaching, quickened, addStatus } from '../../abilities/traitDefs.js'

// Warrior W — directional charge. The composable gap-closer: gapCloseStrike
// glides up to `range` tiles (the SAME glide verb the hand-written version used,
// so the dash animation is unchanged), and if the path stops on an enemy it
// lands a WEAPON hit + knockback + the rider statuses. Damage is the weapon's
// (weapon-delegated — damageMin/Max stay 0); the ladder grows the riders.
export default class Charge extends Ability {
    name = 'Charge'
    icon = 31
    description = 'Step up to 3 tiles in a direction; attack the first enemy hit, shove them back 2 tiles, and stun for a turn. 1 AP / 2 MP, cd 4.'
    cost = { ap: 1, mp: 2 }
    cooldown = 4
    range = 3
    target = 'direction'

    // Riders on the weapon hit (read at activate time, so ladder mutations bite).
    knockbackTiles = 2
    appliesStatus = stun

    // --- Progression ladder -----------------------------------------------------
    //   L1 base : reach 3 · knockback 2 · stun · cd 4
    //   L2      : reach 4                                              [boost]
    //   L3      : pick an augment (lance / bullCharge / relentless)
    //   L4      : a trait slot opens (reaching / quickened / hamstring)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.range += 1 },   // reach 3 -> 4
    }

    // Mutually-exclusive build identity at L3.
    augments = {
        lance:       { label: 'Lance',       apply: a => { a.range += 2; a.knockbackTiles += 1 } },
        bullCharge:  { label: 'Bull Charge', apply: a => { a.knockbackTiles += 2 } },
        relentless:  { label: 'Relentless',  apply: a => { a.cooldown = Math.max(0, a.cooldown - 2); a.cost = { ...a.cost, mp: Math.max(0, a.cost.mp - 1) } } },
    }

    // Additive trait at L4. Hamstring adds a second rider (slow) on top of stun.
    traits = {
        reaching:  reaching(2),
        quickened: quickened(1),
        hamstring: addStatus('Hamstring', slow),
    }

    activate(hero, target) {
        const result = gapCloseStrike(this, hero, target.dx, target.dy, {
            maxSteps: this.range,
            knockbackTiles: this.knockbackTiles,
            statuses: this.appliesStatus,
        })
        if (result === false) return false   // nowhere to go — gapCloseStrike logged it
    }
}
