import Ability from './Ability.js'
import dungeon from '../../Dungeon.js'
import gameLog from '../../GameLog.js'
import bleed from '../../tags/bleed.js'
import { playBurst } from '../../Animations.js'
import { quickened } from '../../abilities/traitDefs.js'

// Warrior ULTIMATE — The Reaving. A committed flurry: sweep the mainhand through
// every adjacent enemy `passes` times in one move (the full Combat pipeline per
// swing, like Cleave/Whirlwind — weapon flavor / crit / block all apply), leaving
// each Bleeding. The brute capstone. tier:'ultimate' — big, long cooldown,
// always-ready (no stat gate; it's a class signature).
export default class TheReaving extends Ability {
    name = 'The Reaving'
    icon = 31
    description = 'Sweep every adjacent enemy in a committed flurry — 3 passes — leaving each Bleeding. 1 AP, cd 12. Requires a weapon.'
    cost = { ap: 1, mp: 0 }
    cooldown = 12
    range = 1
    target = 'adjacentEnemies'
    tier = 'ultimate'

    // Number of full sweeps over the adjacent enemies in one cast.
    passes = 3

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.passes += 1 },
    }

    augments = {
        relentless: { label: 'Relentless', apply: a => { a.passes += 2 } },
        swift:      { label: 'Swift', apply: a => { a.cooldown = Math.max(0, a.cooldown - 3) } },
    }

    traits = {
        quickened: quickened(2),
    }

    activate(hero, target) {
        const weapon = hero.currentWeapon()
        if (!weapon) { gameLog.log(`${hero.name} has no weapon equipped.`); return false }
        if (!target.entities.length) { gameLog.log(`No enemies in reach to reave.`); return false }
        for (let p = 0; p < this.passes; p++) {
            playBurst(hero.x, hero.y, { radius: 1.5 })
            for (const victim of target.entities) {
                if (!victim.sprite) continue            // fell in an earlier pass
                dungeon.attackEntity(hero, victim, weapon)
                if (victim.sprite) victim.addTag(bleed)
            }
        }
    }
}
