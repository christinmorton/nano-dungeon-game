import Ability from './Ability.js'
import dungeon from '../../Dungeon.js'
import gameLog from '../../GameLog.js'
import bleed from '../../tags/bleed.js'
import sunder from '../../tags/sunder.js'
import weaken from '../../tags/weaken.js'
import slow from '../../tags/slow.js'
import { knockback, resolveDamage } from '../../abilities/universals.js'
import { addStatus, quickened, bump } from '../../abilities/traitDefs.js'

// Slash — a deep cut on a single adjacent enemy via the full weapon pipeline,
// leaving Bleed (physical DoT) behind. Weapon-delegated: damage is the weapon's
// (scaled by damageMult); the ability layers Bleed + ladder riders on top.
// Unslotted.
export default class Slash extends Ability {
    name = 'Slash'
    icon = 31
    description = 'Slash an adjacent enemy, causing Bleed. 1 AP, cd 3.'
    cost = { ap: 1, mp: 0 }
    cooldown = 3
    range = 1
    target = 'pickEnemy'

    // Declarative riders (mutated by the ladder). Baseline: weapon damage + Bleed.
    damageMult = 1.0
    appliesStatus = bleed
    bonusDamage = 0
    knockbackTiles = 0

    // --- Progression ladder ----------------------------------------------------
    //   L1 : weapon damage + Bleed
    //   L2 : 1.2x damage                                             [boost]
    //   L3 : augment — Gash (+dmg) | Rend (+sunder) | Maim (+weaken)
    //   L4 : a trait slot (Quickened | Overpower +dmg | Crippling +slow)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMult = 1.2 },
    }

    augments = {
        gash: { label: 'Gash', apply: a => { a.bonusDamage += 5 } },
        rend: addStatus('Rend', sunder),
        maim: addStatus('Maim', weaken),
    }

    traits = {
        quickened: quickened(1),
        overpower: bump('Overpower', 'bonusDamage', 6),
        crippling: addStatus('Crippling', slow),
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
