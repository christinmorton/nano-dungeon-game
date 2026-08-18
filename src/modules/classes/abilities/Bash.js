import Phaser from 'phaser'
import Ability from './Ability.js'
import dungeon from '../../Dungeon.js'
import gameLog from '../../GameLog.js'
import stun from '../../tags/stun.js'
import sunder from '../../tags/sunder.js'
import slow from '../../tags/slow.js'
import { knockback, resolveDamage } from '../../abilities/universals.js'

// Physical pool ability — a heavy bash on a single adjacent enemy: weapon damage
// and a CHANCE to Stun. A blunt-force blow, so it's gated to bludgeoning weapons
// (requiresWeaponCategory): clubs / maces / hammers / staves — a sword or dagger
// can't reliably bash. Weapon-delegated: damage IS the equipped weapon's; the
// ability adds the stun (and ladder riders).
//
// DEFERRED (noted for later, out of scope now): giving enemy NATURAL weapons a
// 'natural'/'blunt' category so a bear / ogre / golem can Bash, and unarmed
// brute/monk 'fist' attacks — both wait on weapon categories for enemies + a
// brute/monk class that doesn't exist yet. 'fist'/'natural' are already in the
// gate below so they light up for free once that lands.

export default class Bash extends Ability {
    name = 'Bash'
    icon = 31
    description = 'Bash an adjacent enemy with a blunt weapon: a heavy blow (1.5x weapon damage) and a 50% chance to Stun. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 1
    target = 'pickEnemy'

    // Blunt-force gate. 'fist'/'natural' are forward-looking (see the note above).
    requiresWeaponCategory = ['blunt', 'fist', 'natural']

    // Presentation: an overhead/overhand slam instead of the default horizontal
    // swing — sells the blunt-force blow. Threaded through dungeon.attackEntity.
    strikeStyle = 'overhead'

    // Declarative riders, mutated by the ladder. Baseline: a heavy blow (1.5x
    // weapon damage), a stun CHANCE, NO knockback (removed from baseline), no flat
    // bonus. appliesStatus (inherited) stays null until an augment/trait adds one.
    // damageMult amplifies the weapon's damage (weapon-delegated abilities scale
    // by a multiplier, not min/max — see the progression doc S4.4); bonusDamage is
    // a separate FLAT add the Brutal augment / Overpower trait layer on top.
    damageMult = 1.5
    stunChance = 0.5
    knockbackTiles = 0
    bonusDamage = 0

    // --- Progression ladder (straightforward; max rank = guaranteed stun) ---
    //   L1 : 1.5x weapon damage + 50% stun
    //   L2 : 1.8x damage + 70% stun
    //   L3 : augment — Sunder (armor break) | Crushing (knockback) | Brutal (+dmg)
    //   L4 : 2.2x damage + guaranteed stun (100%) + a trait slot
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMult = 1.8; a.stunChance = 0.7 },
        4: a => { a.damageMult = 2.2; a.stunChance = 1.0 },   // heavier + guaranteed stun at max rank
    }

    augments = {
        sunder:   { label: 'Sunder',   apply: a => { a.appliesStatus = pushStatus(a.appliesStatus, sunder) } },
        crushing: { label: 'Crushing', apply: a => { a.knockbackTiles = 1 } },
        brutal:   { label: 'Brutal',   apply: a => { a.bonusDamage += 5 } },
    }

    traits = {
        overpower:  { label: 'Overpower',  apply: a => { a.bonusDamage += 6 } },
        relentless: { label: 'Relentless', apply: a => { a.cooldown = Math.max(1, a.cooldown - 2) } },
        staggering: { label: 'Staggering', apply: a => { a.appliesStatus = pushStatus(a.appliesStatus, slow) } },
    }

    activate(hero, target) {
        const weapon = hero.currentWeapon()
        if (!weapon) {
            gameLog.log(`${hero.name} has no weapon to bash with.`)
            return false
        }
        const victim = target.entity
        const dx = Math.sign(victim.x - hero.x)
        const dy = Math.sign(victim.y - hero.y)

        dungeon.attackEntity(hero, victim, weapon, { strikeStyle: this.strikeStyle, damageMult: this.damageMult })
        if (!victim.sprite) return

        // Bonus flat damage (Brutal / Overpower), ability-side after the weapon hit.
        if (this.bonusDamage > 0) {
            const result = resolveDamage(victim, this.bonusDamage, 'physical')
            if (result.killed) return
        }
        // Stun chance — guaranteed at max rank (stunChance 1.0).
        if (Phaser.Math.FloatBetween(0, 1) < this.stunChance) {
            victim.addTag(stun)
            gameLog.log(`${hero.name}'s Bash stuns ${victim.name}.`)
        }
        // Ladder riders.
        if (this.knockbackTiles > 0) knockback(victim, dx, dy, this.knockbackTiles)
        for (const status of [].concat(this.appliesStatus || [])) victim.addTag(status)
    }
}

// Append a status template to an ability's appliesStatus (null -> single ->
// array), so an augment AND a trait can each add one without clobbering.
function pushStatus(current, status) {
    return current ? [...[].concat(current), status] : status
}
