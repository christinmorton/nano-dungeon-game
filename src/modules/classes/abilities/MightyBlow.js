import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import sunder from '../../tags/sunder.js'
import slow from '../../tags/slow.js'
import { resolveDamage, knockback } from '../../abilities/universals.js'
import { playSlashArc } from '../../Animations.js'
import { addStatus, quickened, bump } from '../../abilities/traitDefs.js'

// Mighty Blow (the de-WoW rename of Power Strike) — one heavy committed blow on
// an adjacent enemy for a MULTIPLE of your normal hit, GUARANTEED (no crit/block
// roll — that guaranteed, variance-free burst is its identity, so it stays
// self-computed off hero.attack() rather than routing through the weapon
// pipeline). The Warrior's single-target finisher, complementing Cleave (AOE)
// and Charge (gap-close). Works unarmed (no weapon gate).
export default class MightyBlow extends Ability {
    name = 'Mighty Blow'
    icon = 31
    description = 'A heavy single strike on an adjacent enemy for double damage. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 1
    target = 'pickEnemy'

    // Declarative payload (mutated by the ladder). Damage = floor(hero.attack() *
    // damageMult) + bonusDamage. No status rider at base — pure burst.
    damageMult = 2.0
    bonusDamage = 0
    appliesStatus = null
    knockbackTiles = 0

    // --- Progression ladder ----------------------------------------------------
    //   L1 : 2.0x damage, guaranteed
    //   L2 : 2.4x damage                                             [boost]
    //   L3 : augment — Devastating (+dmg) | Sundering (+sunder) | Overbearing (knockback)
    //   L4 : a trait slot (Quickened | Brutal +mult | Staggering +slow)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMult = 2.4 },
    }

    augments = {
        devastating: { label: 'Devastating', apply: a => { a.bonusDamage += 8 } },
        sundering:   addStatus('Sundering', sunder),
        overbearing: { label: 'Overbearing', apply: a => { a.knockbackTiles = 1 } },
    }

    traits = {
        quickened:  quickened(1),
        brutal:     bump('Brutal', 'damageMult', 0.4),
        staggering: addStatus('Staggering', slow),
    }

    activate(hero, target) {
        const victim = target.entity
        const dx = Math.sign(victim.x - hero.x)
        const dy = Math.sign(victim.y - hero.y)
        playSlashArc(victim.x, victim.y)

        const damage = Math.floor(hero.attack() * this.damageMult) + this.bonusDamage
        const result = resolveDamage(victim, damage, 'physical')
        gameLog.log(`${hero.name} lands a Mighty Blow on ${victim.name} for ${result.applied}.`)
        if (result.killed || !victim.sprite) return

        if (this.knockbackTiles > 0) knockback(victim, dx, dy, this.knockbackTiles)
        for (const status of [].concat(this.appliesStatus || [])) victim.addTag(status)
    }
}
