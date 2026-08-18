import Ability from './Ability.js'
import dungeon from '../../Dungeon.js'
import gameLog from '../../GameLog.js'
import stun from '../../tags/stun.js'
import sunder from '../../tags/sunder.js'
import slow from '../../tags/slow.js'
import { knockback, resolveDamage } from '../../abilities/universals.js'
import { addStatus, quickened, bump } from '../../abilities/traitDefs.js'

// Bludgeon — a crushing hammer blow that GUARANTEES a Stun (where Bash, the
// versatile blunt strike, only has a chance). Weapon-delegated: damage is the
// equipped weapon's, scaled by damageMult; the ability layers the stun + ladder
// riders on top. Overhead strike style sells the slam. Hammer-only.
//
// Gate note: hammers/maces/staves all share weaponCategory 'blunt', so there's
// no finer 'hammer' class to gate on — the name-match keeps Bludgeon hammer-
// flavored. Swap to requiresWeaponCategory:['blunt'] if you'd rather any blunt
// weapon bludgeon (it'd then overlap Bash's pool). Unslotted.
export default class Bludgeon extends Ability {
    name = 'Bludgeon'
    icon = 31
    description = 'Crush an adjacent enemy with a hammer for a heavy blow that Stuns. Requires a hammer. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 1
    target = 'pickEnemy'

    strikeStyle = 'overhead'

    // Declarative riders (mutated by the ladder). Baseline: weapon damage, a
    // GUARANTEED stun, no flat bonus, no knockback.
    damageMult = 1.0
    appliesStatus = stun
    bonusDamage = 0
    knockbackTiles = 0

    // --- Progression ladder ----------------------------------------------------
    //   L1 : weapon damage + guaranteed Stun
    //   L2 : 1.3x damage                                              [boost]
    //   L3 : augment — Skullcracker (+dmg) | Reverberate (+sunder) | Crushing (knockback)
    //   L4 : a trait slot (Quickened | Overpower | Staggering +slow)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMult = 1.3 },
    }

    augments = {
        skullcracker: { label: 'Skullcracker', apply: a => { a.bonusDamage += 6 } },
        reverberate:  addStatus('Reverberate', sunder),
        crushing:     { label: 'Crushing', apply: a => { a.knockbackTiles = 1 } },
    }

    traits = {
        quickened:  quickened(1),
        overpower:  bump('Overpower', 'bonusDamage', 6),
        staggering: addStatus('Staggering', slow),
    }

    activate(hero, target) {
        const weapon = hero.currentWeapon()
        if (!weapon || !/hammer/i.test(weapon.name)) {
            gameLog.log(`${hero.name} needs a hammer to bludgeon.`)
            return false
        }
        const victim = target.entity
        const dx = Math.sign(victim.x - hero.x)
        const dy = Math.sign(victim.y - hero.y)

        dungeon.attackEntity(hero, victim, weapon, { strikeStyle: this.strikeStyle, damageMult: this.damageMult })
        if (!victim.sprite) return

        if (this.bonusDamage > 0) {
            const result = resolveDamage(victim, this.bonusDamage, 'physical')
            if (result.killed) return
        }
        if (this.knockbackTiles > 0) knockback(victim, dx, dy, this.knockbackTiles)
        for (const status of [].concat(this.appliesStatus || [])) victim.addTag(status)
    }
}
