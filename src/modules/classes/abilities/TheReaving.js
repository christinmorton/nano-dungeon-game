import Ability from './Ability.js'
import dungeon from '../../Dungeon.js'
import gameLog from '../../GameLog.js'
import { playBurst } from '../../Animations.js'

// Warrior ULTIMATE — The Reaving. A committed flurry: sweep the mainhand through
// every adjacent enemy `passes` times in one move (the full Combat pipeline per
// swing, like Cleave — weapon flavor / crit / block all apply). The brute
// capstone. tier:'ultimate' — big, long cooldown, always ready when off cooldown
// (no stat gate; it is a class signature, not something you qualify for).
//
// v3's version left every victim Bleeding. v5 has no `bleed` among its ten
// statuses (scope doc §5), and adding one for a single ability would have grown
// a second cap, so this ships as pure burst — three passes of real weapon hits
// is already the identity. Recorded in scope doc §10.5.
//
// Progression ladder dropped (levelBoosts / augments / traits), like every other
// ability ported into v5.

export default class TheReaving extends Ability {
    name = 'The Reaving'
    icon = 5
    description = 'Three full weapon passes through every adjacent enemy. 1 AP, cd 12.'
    cost = { ap: 1, mp: 0 }
    cooldown = 12
    range = 1
    target = 'adjacentEnemies'
    tier = 'ultimate'

    // Number of full sweeps over the adjacent enemies in one cast.
    passes = 3

    activate(hero, target) {
        const weapon = hero.currentWeapon()
        if (!weapon) { gameLog.log(`${hero.name} has no weapon equipped.`); return false }
        if (!target.entities.length) { gameLog.log(`No enemies in reach to reave.`); return false }

        for (let p = 0; p < this.passes; p++) {
            playBurst(hero.x, hero.y, { radius: 1.5 })
            for (const victim of target.entities) {
                // Guarded per pass: anything that fell earlier in the flurry has
                // lost its sprite, and swinging at a corpse would spend the hit.
                if (!victim.sprite) continue
                dungeon.attackEntity(hero, victim, weapon)
            }
        }
    }
}
