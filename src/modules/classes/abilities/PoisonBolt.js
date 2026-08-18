import Phaser from 'phaser'
import Ability from './Ability.js'
import { bolt } from '../../abilities/patterns.js'
import { applyPoison } from '../../tags/poison.js'
import { empowered, reaching, quickened } from '../../abilities/traitDefs.js'

// Decay tree — a venomous bolt: a modest magicPower-scaled hit plus Poison, a
// long, low-tick damage-over-time. The tree's single-target DoT delivery; the
// patient counterpart to Fire's burst bolt. Converted onto patterns.bolt; the
// recolored-green projectile is preserved. Re-poisoning refreshes (applyPoison).
// Library/unslotted.

const POISON_TINT = 0x44cc44
const POISON_PROJECTILE_TILE = 567

export default class PoisonBolt extends Ability {
    name = 'Poison Bolt'
    icon = 31
    description = 'Spit a venomous bolt at an enemy (range 5): magicPower + 2..4 damage and Poison (3/turn for 4 turns). 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 5
    target = 'pickEnemy'
    fxColor = POISON_TINT

    // Self-computed impact (magicPower-scaled, like the other element bolts).
    damageMin = 2
    damageMax = 4
    damageStat = 'magicPower'
    damageType = 'magic'

    // Poison DoT (declarative so the ladder can scale it). Applied via applyPoison
    // in onImpact rather than the declarative appliesStatus slot, so the per-turn
    // damage and duration are explicit (addTag's default poison is 1/turn).
    poisonDamage = 3
    poisonTurns = 4

    // --- Progression ladder ----------------------------------------------------
    //   L1 : magic+2..4 impact · Poison 3/turn x4
    //   L2 : +1 poison/turn                                                [boost]
    //   L3 : augment — Virulent (+poison) | Caustic (+impact) | Debilitating (longer)
    //   L4 : a trait slot — Empowered | Reaching | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.poisonDamage += 1 },
    }

    augments = {
        virulent:     { label: 'Virulent',     apply: a => { a.poisonDamage += 2; a.poisonTurns += 1 } },
        caustic:      { label: 'Caustic',      apply: a => { a.damageMin += 4; a.damageMax += 6 } },
        debilitating: { label: 'Debilitating', apply: a => { a.poisonTurns += 4 } },
    }

    traits = {
        empowered: empowered(3),
        reaching:  reaching(2),
        quickened: quickened(1),
    }

    activate(hero, target) {
        const victim = target.entity
        bolt(this, hero, victim, {
            castType: 'arcane',
            projectile: { attackTile: POISON_PROJECTILE_TILE, tint: POISON_TINT },
            onImpact: (v, result) => {
                if (!result.killed) {
                    applyPoison(v, this.poisonDamage, this.poisonTurns)
                }
            },
        })
    }
}
