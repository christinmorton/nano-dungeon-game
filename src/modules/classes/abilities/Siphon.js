import Phaser from 'phaser'
import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { castSpell, drain } from '../../abilities/universals.js'
import { reaching, efficient, bump } from '../../abilities/traitDefs.js'

// Siphon — the Void lifedrain INVOCATION (the dark-caster flavor of the channel
// mechanic; verb "siphoning"). Toggle it on a target and it auto-drains each
// round — magic damage that heals the caster for a fraction — until the target
// dies, the caster is disabled, the target leaves sight, or you toggle it off.
// While siphoning the caster can't move or use other abilities. Canonical
// consumer of the `drain` universal. Library/unslotted (Void).

const SIPHON_TINT = 0x9b59d0          // void purple
const SIPHON_PROJECTILE_TILE = 567

export default class Siphon extends Ability {
    name = 'Siphon'
    icon = 31
    description = "Invoke a life-drain (range 5): each round, magicPower + 2..5 magic damage, healing you for half. Toggle on/off; breaks if the target dies, you're disabled, or it leaves sight."
    cost = { ap: 1, mp: 0 }
    cooldown = 0
    range = 5
    target = 'pickEnemy'
    channeled = true
    invokeVerb = 'siphoning'
    breaksOnLineOfSight = true
    fxColor = SIPHON_TINT

    drainMin = 2
    drainMax = 5
    drainRatio = 0.5           // fraction of damage returned as healing

    // --- Progression ladder ----------------------------------------------------
    //   L1 : magic+2..5/round, heal 50%
    //   L2 : +2 drain/round                                                [boost]
    //   L3 : augment — Greater Drain (+drain) | Vampiric (heal 75%) | Far Siphon (+range)
    //   L4 : a trait slot — Ravenous (+drain) | Insatiable (+heal ratio) | Reaching
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.drainMin += 2; a.drainMax += 2 },
    }

    augments = {
        greater:   { label: 'Greater Drain', apply: a => { a.drainMin += 3; a.drainMax += 4 } },
        vampiric:  { label: 'Vampiric',      apply: a => { a.drainRatio = 0.75 } },
        farSiphon: { label: 'Far Siphon',    apply: a => { a.range += 3 } },
    }

    traits = {
        ravenous:   bump('Ravenous', 'drainMax', 3),
        insatiable: { label: 'Insatiable', apply: a => { a.drainRatio += 0.15 } },
        reaching:   reaching(2),
    }

    tick(hero, target) {
        castSpell(hero, target, {
            castType: 'arcane',
            projectile: { attackTile: SIPHON_PROJECTILE_TILE, tint: SIPHON_TINT },
            onImpact: (v) => {
                const roll = Phaser.Math.Between(this.drainMin, this.drainMax)
                const { applied, gained } = drain(hero, v, hero.stat('magicPower') + roll, {
                    damageType: 'magic',
                    resource: 'hp',
                    ratio: this.drainRatio,
                })
                const healText = gained > 0 ? ` and heals ${gained}` : ''
                gameLog.log(`${hero.name}'s Siphon drains ${v.name} for ${applied}${healText}.`)
            },
        })
    }
}
