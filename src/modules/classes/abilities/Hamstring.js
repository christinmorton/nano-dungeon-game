import Ability from './Ability.js'
import dungeon from '../../Dungeon.js'
import gameLog from '../../GameLog.js'
import slow from '../../tags/slow.js'
import weaken from '../../tags/weaken.js'
import sunder from '../../tags/sunder.js'
import bleed from '../../tags/bleed.js'
import { knockback, resolveDamage } from '../../abilities/universals.js'
import { addStatus, quickened, bump } from '../../abilities/traitDefs.js'

// Hamstring (→ Hobble per the §1.6 rename) — a low cut to an adjacent enemy's
// legs: weapon damage plus Slow (reduced movement). Weapon-delegated: damage is
// the weapon's (scaled by damageMult); the ability layers Slow + ladder riders.
// The skirmisher's kiting tool. Unslotted.
export default class Hamstring extends Ability {
    name = 'Hamstring'
    icon = 31
    description = 'Strike an adjacent enemy and Slow their movement. 1 AP, cd 3.'
    cost = { ap: 1, mp: 0 }
    cooldown = 3
    range = 1
    target = 'pickEnemy'

    // Declarative riders (mutated by the ladder). Baseline: weapon damage + Slow.
    damageMult = 1.0
    appliesStatus = slow
    bonusDamage = 0
    knockbackTiles = 0

    // --- Progression ladder ----------------------------------------------------
    //   L1 : weapon damage + Slow
    //   L2 : 1.2x damage                                             [boost]
    //   L3 : augment — Deep Cut (+dmg) | Cripple (+weaken) | Sever (+sunder)
    //   L4 : a trait slot (Quickened | Overpower +dmg | Hemorrhage +bleed)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMult = 1.2 },
    }

    augments = {
        deepCut: { label: 'Deep Cut', apply: a => { a.bonusDamage += 5 } },
        cripple: addStatus('Cripple', weaken),
        sever:   addStatus('Sever', sunder),
    }

    traits = {
        quickened:  quickened(1),
        overpower:  bump('Overpower', 'bonusDamage', 6),
        hemorrhage: addStatus('Hemorrhage', bleed),
    }

    activate(hero, target) {
        const weapon = hero.currentWeapon()
        if (!weapon) {
            gameLog.log(`${hero.name} has no weapon equipped.`)
            return false
        }
        const victim = target.entity
        const dx = Math.sign(victim.x - hero.x)
        const dy = Math.sign(victim.y - hero.y)

        dungeon.attackEntity(hero, victim, weapon, { damageMult: this.damageMult })
        if (!victim.sprite) return

        if (this.bonusDamage > 0) {
            const result = resolveDamage(victim, this.bonusDamage, 'physical')
            if (result.killed) return
        }
        if (this.knockbackTiles > 0) knockback(victim, dx, dy, this.knockbackTiles)
        for (const status of [].concat(this.appliesStatus || [])) victim.addTag(status)
    }
}
