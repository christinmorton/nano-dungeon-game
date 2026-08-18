import Ability from './Ability.js'
import { shapeStrike } from '../../abilities/patterns.js'
import rooted from '../../tags/rooted.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Earth control — grasping roots erupt around you, entangling every enemy in the
// circle (Rooted — can't move, can still act). Minimal chip; the mass immobilize
// is the point (set up a nova / let allies reposition). Delivery =
// patterns.shapeStrike (+ circle). Library/unslotted.

const EARTH_TINT = 0x6b8e23

export default class EntanglingRoots extends Ability {
    name = 'Entangling Roots'
    icon = 31
    description = 'Roots erupt: snare every enemy within 2 tiles (Rooted) and chip them. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 2
    target = 'self'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = EARTH_TINT

    damageMin = 1
    damageMax = 2
    damageStat = null
    damageType = 'magic'
    appliesStatus = rooted

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 snare, 1-2 chip + Rooted
    //   L2 : +1 radius                                                     [boost]
    //   L3 : augment — Wide Thicket (+radius) | Thorned (+dmg) | Rapid (cd -1)
    //   L4 : a trait slot — Enlarge (+radius) | Deep (+chip) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1; a.shape.radius += 1 },
    }

    augments = {
        wide:    { label: 'Wide Thicket', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        thorned: { label: 'Thorned', apply: a => { a.damageMin += 2; a.damageMax += 3 } },
        rapid:   { label: 'Rapid Growth', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        enlarge:   { label: 'Enlarge', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        deep:      bump('Deep', 'damageMax', 3),
        quickened: quickened(1),
    }

    activate(hero) {
        return shapeStrike(this, hero, 0, 0, { splash: true })
    }
}
