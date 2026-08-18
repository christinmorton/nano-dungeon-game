import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { heal, resolveDamage } from '../../abilities/universals.js'
import { isUndead } from '../../enemies/enemyKinds.js'
import fear from '../../tags/fear.js'
import { quickened } from '../../abilities/traitDefs.js'

// Holy tree — adjacent AOE that only burns UNDEAD: magicPower × mult per victim,
// the Cleric's panic button against a swarm of skeletons/ghouls/ghosts. Refunds
// when no adjacent enemy is undead. Thematic ladder: Rout makes the turned undead
// FLEE (Fear), Sanctified heals you for each one you turn.
// PLANNED RENAME → "Lay to Rest" (de-WoW §1.6); kept until the user confirms.
// Slotted (Cleric).

export default class TurnUndead extends Ability {
    name = 'Turn Undead'
    icon = 31
    description = 'Burn every adjacent undead (Skeletons, Ghouls, Ghosts...) for magicPower × 2. 1 AP, cd 8.'
    cost = { ap: 1, mp: 0 }
    cooldown = 8
    range = 1
    target = 'adjacentEnemies'
    fxColor = 0xFFD700

    damageMult = 2             // magicPower × this per undead
    routs = false              // augment: also Fear (rout) the turned undead
    sanctified = 0             // augment: heal the caster per undead turned

    // --- Progression ladder ----------------------------------------------------
    //   L1 : magicPower×2 to adjacent undead
    //   L2 : ×0.5 more damage                                              [boost]
    //   L3 : augment — Sear (+mult) | Rout (turned undead flee) | Sanctified (heal/turn)
    //   L4 : a trait slot — Searing (+mult) | Lasting Rout | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    routTurns = 3

    levelBoosts = {
        2: a => { a.damageMult += 0.5 },
    }

    augments = {
        sear:       { label: 'Sear',       apply: a => { a.damageMult += 1 } },
        rout:       { label: 'Rout',       apply: a => { a.routs = true } },
        sanctified: { label: 'Sanctified', apply: a => { a.sanctified = 5 } },
    }

    traits = {
        searing:     { label: 'Searing',      apply: a => { a.damageMult += 0.5 } },
        lastingRout: { label: 'Lasting Rout', apply: a => { a.routTurns += 2 } },
        quickened:   quickened(2),
    }

    activate(hero, target) {
        const undead = target.entities.filter(e => isUndead(e))
        if (!undead.length) {
            gameLog.log(`No undead adjacent to turn.`)
            return false
        }
        const rawDamage = Math.round(hero.stat('magicPower') * this.damageMult)
        playCast(hero, { type: 'heal' })
        let turned = 0
        for (const victim of undead) {
            const result = resolveDamage(victim, rawDamage, 'magic', { aoe: true, attacker: hero })
            gameLog.log(`Turn Undead burns ${victim.name} for ${result.applied}.`)
            if (!result.killed) {
                turned += 1
                if (this.routs) victim.addTag(fear, this.routTurns)
            }
        }
        if (this.sanctified && turned) {
            const restored = heal(hero, this.sanctified * turned)
            if (restored) gameLog.log(`${hero.name} is sanctified, restoring ${restored} HP.`)
        }
    }
}
