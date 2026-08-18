import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { terrainWall } from '../../abilities/patterns.js'
import { reaching, quickened, bump } from '../../abilities/traitDefs.js'

// Arcane Wall — a barrier of raw making-current, and the wall set's "idealized
// protection": it blocks enemy movement AND every projectile — physical arrows
// AND magic spell-bolts (the kind/style flags blocksProjectile + blocksMagic;
// the ONLY wall that contains magic). Stays see-through (no sight block), and the
// caster + allies pass and shoot through it freely (friendly side). Its niche is
// the anti-ranged / anti-caster screen. Delivery is the composable `terrainWall`.
export default class ArcaneWall extends Ability {
    name = 'Arcane Wall'
    icon = 31
    description = 'Raise a barrier of force — blocks enemy movement AND all projectiles, including spells (the only wall that stops magic). See-through; you pass and shoot through freely. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    radius = 0
    wallLength = 3
    wallDuration = 4            // rounds the wall persists (hoisted for the ladder)
    target = 'aoeTile'

    // --- Progression ladder ----------------------------------------------------
    //   L1 : length 3, lasts 4 rounds
    //   L2 : +1 round                                                      [boost]
    //   L3 : augment — Greater Wall (+2 length) | Lasting Wall (+3 rounds) | Swift (cd -2)
    //   L4 : a trait slot — Extended (+length) | Reaching (+range) | Quickened (cd -1)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.wallDuration += 1 },
    }

    augments = {
        greater: { label: 'Greater Wall', apply: a => { a.wallLength += 2 } },
        lasting: { label: 'Lasting Wall', apply: a => { a.wallDuration += 3 } },
        swift:   { label: 'Swift Wall', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        extended:  bump('Extended', 'wallLength', 1),
        reaching:  reaching(2),
        quickened: quickened(1),
    }

    activate(hero, target) {
        const segments = terrainWall(this, hero, target.tile, {
            blocks: true,
            blocksSight: false,
            kind: 'arcane',
            duration: this.wallDuration,
        })
        if (segments === false) return false   // no room — terrainWall already logged it
        gameLog.log(`${hero.name} conjures a wall of force.`)
    }
}
