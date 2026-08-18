import Ability from './Ability.js'
import { mark } from '../../abilities/patterns.js'
import burning from '../../tags/burning.js'
import { empowered, enlarge, quickened } from '../../abilities/traitDefs.js'

// Fire damage — the COMBO enabler. Brand an enemy with a fire sigil that DETONATES
// after a short fuse: a circular blast for magicPower-scaled damage that ignites
// everything caught (Burning). Set it up, then herd enemies into the blast — or
// stack it with a nova. Delivery = patterns.mark (the delayed-detonation pattern;
// its status rider carries Burning into the blast). Library/unslotted.

const FIRE_TINT = 0xff5522

export default class PyreMark extends Ability {
    name = 'Pyre Mark'
    icon = 31
    description = 'Brand an enemy with a fire sigil (range 5): after 2 turns it detonates a magicPower + 4..8 blast, igniting all caught (Burning). 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 5
    target = 'pickEnemy'
    radius = 1                  // detonation blast radius
    fuseTurns = 2               // turns before it blows
    fxColor = FIRE_TINT

    damageMin = 4
    damageMax = 8
    damageStat = 'magicPower'
    damageType = 'magic'
    appliesStatus = burning     // carried into the blast as the survivor rider

    // --- Progression ladder ----------------------------------------------------
    //   L1 : 2-turn fuse, magicPower + 4..8 blast (r1) + Burning
    //   L2 : +2/+2 damage                                                  [boost]
    //   L3 : augment — Bigger Blast (+radius) | Fast Fuse (-1 turn) | Overload (+dmg)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 2; a.damageMax += 2 },
    }

    augments = {
        bigBlast: { label: 'Bigger Blast', apply: a => { a.radius += 1 } },
        fastFuse: { label: 'Fast Fuse', apply: a => { a.fuseTurns = Math.max(1, a.fuseTurns - 1) } },
        overload: { label: 'Overload', apply: a => { a.damageMin += 4; a.damageMax += 6 } },
    }

    traits = {
        empowered: empowered(3),
        enlarge:   enlarge(1),
        quickened: quickened(1),
    }

    activate(hero, target) {
        return mark(this, hero, target.entity, { castType: 'fire', turns: this.fuseTurns })
    }
}
