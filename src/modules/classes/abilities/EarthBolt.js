import Ability from './Ability.js'
import { knockback } from '../../abilities/universals.js'
import { bolt } from '../../abilities/patterns.js'
import { empowered, quickened, bump } from '../../abilities/traitDefs.js'

// Earth damage — launch a conjured boulder at a picked enemy: magicPower-scaled
// damage plus a knockback as the mass slams in. Delivery = patterns.bolt with a
// knockback rider in onImpact. Library/unslotted.

const EARTH_TINT = 0x9a7b4f
const EARTH_PROJECTILE_TILE = 567

export default class EarthBolt extends Ability {
    name = 'Earth Bolt'
    icon = 31
    description = 'Launch a boulder at an enemy (range 5): magicPower + 3..6 damage and knock them back 2. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 5
    target = 'pickEnemy'

    damageMin = 3
    damageMax = 6
    damageStat = 'magicPower'
    damageType = 'magic'
    knockbackTiles = 2
    fxColor = EARTH_TINT

    // --- Progression ladder ----------------------------------------------------
    //   L1 : magicPower + 3..6, knock 2
    //   L2 : +1/+2 damage                                                  [boost]
    //   L3 : augment — Boulder (+dmg) | Heavy (+knockback) | Rapid Cast (cd -1)
    //   L4 : a trait slot — Empowered | Forceful (+knockback) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 1; a.damageMax += 2 },
    }

    augments = {
        boulder: { label: 'Boulder', apply: a => { a.damageMin += 3; a.damageMax += 4 } },
        heavy:   { label: 'Heavy Slam', apply: a => { a.knockbackTiles += 1 } },
        rapid:   { label: 'Rapid Cast', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        empowered: empowered(2),
        forceful:  bump('Forceful', 'knockbackTiles', 1),
        quickened: quickened(1),
    }

    activate(hero, target) {
        const victim = target.entity
        const dx = Math.sign(victim.x - hero.x)
        const dy = Math.sign(victim.y - hero.y)
        bolt(this, hero, victim, {
            castType: 'arcane',
            projectile: { attackTile: EARTH_PROJECTILE_TILE, tint: EARTH_TINT },
            onImpact: (v, result) => { if (!result.killed) knockback(v, dx, dy, this.knockbackTiles) },
        })
    }
}
