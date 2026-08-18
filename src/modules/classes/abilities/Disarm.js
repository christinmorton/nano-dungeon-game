import Ability from './Ability.js'
import dungeon from '../../Dungeon.js'
import gameLog from '../../GameLog.js'
import disarmed from '../../tags/disarmed.js'
import { resolveDamage } from '../../abilities/universals.js'
import { bump } from '../../abilities/traitDefs.js'

// Disarm — a precise melee maneuver: weapon damage plus Disarmed (greatly reduced
// attack) for a few turns, knocking a foe's weapon aside. Weapon-delegated (damage
// is the equipped weapon's, scaled by damageMult), the Bash/Slash family pattern.
// Unslotted.
export default class Disarm extends Ability {
    name = 'Disarm'
    icon = 31
    description = "A precise strike that knocks aside a foe's weapon: weapon damage + Disarmed (reduced attack) for a few turns. 1 AP, cd 5."
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 1
    target = 'pickEnemy'
    appliesStatus = disarmed

    damageMult = 1.0
    bonusDamage = 0

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMult = 1.2 },
    }

    augments = {
        crippling: { label: 'Crippling', apply: a => { a.bonusDamage += 5 } },
        quickened: { label: 'Quickened', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        thorough: bump('Thorough', 'bonusDamage', 5),
    }

    activate(hero, target) {
        const weapon = hero.currentWeapon()
        if (!weapon) {
            gameLog.log(`${hero.name} has no weapon to disarm with.`)
            return false
        }
        const victim = target.entity
        dungeon.attackEntity(hero, victim, weapon, { damageMult: this.damageMult })
        if (!victim.sprite) return
        if (this.bonusDamage > 0) {
            const result = resolveDamage(victim, this.bonusDamage, 'physical')
            if (result.killed) return
        }
        for (const s of [].concat(this.appliesStatus || [])) victim.addTag(s)
    }
}
