import Ability from './Ability.js'
import { shapeStrike } from '../../abilities/patterns.js'
import stun from '../../tags/stun.js'
import { quickened, enlarge } from '../../abilities/traitDefs.js'

// Dwarf ULTIMATE — Mountainfall. Bring the mountain down: slam the earth so hard the
// ground shatters in a wide ring, dealing heavy PHYSICAL damage and Stunning every
// enemy caught. The dwarf's martial capstone — scales on raw power (attackPower),
// not magic. Self-centered nova. tier:'ultimate'.
const EARTH_TINT = 0x8a6f4a

export default class Mountainfall extends Ability {
    name = 'Mountainfall'
    icon = 31
    description = 'Shatter the ground in a wide ring: attackPower + 16..24 physical damage and Stun every enemy within 2 tiles. 1 AP, cd 12.'
    cost = { ap: 1, mp: 0 }
    cooldown = 12
    range = 2
    target = 'self'
    tier = 'ultimate'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = EARTH_TINT

    damageMin = 16
    damageMax = 24
    damageStat = 'attackPower'
    damageType = 'physical'
    appliesStatus = stun

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 5; a.damageMax += 7 },
    }

    augments = {
        cataclysmic: { label: 'Cataclysmic', apply: a => { a.damageMin += 8; a.damageMax += 12 } },
        wide:        { label: 'Wide', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        swift:       { label: 'Swift', apply: a => { a.cooldown = Math.max(0, a.cooldown - 3) } },
    }

    traits = {
        enlarge:   enlarge(1),
        quickened: quickened(2),
    }

    activate(hero) {
        return shapeStrike(this, hero, 0, 0, { splash: true })
    }
}
