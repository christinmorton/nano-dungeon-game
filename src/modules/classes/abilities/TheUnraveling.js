import Ability from './Ability.js'
import { areaStrike } from '../../abilities/patterns.js'
import { empowered, quickened, enlarge } from '../../abilities/traitDefs.js'

// Wizard ULTIMATE — The Unraveling. A massive arcane detonation that unmakes a wide
// area: huge magic damage to everything caught. The caster capstone — a class
// SIGNATURE (not attunement-gated like the §6.8 god nukes), so no `requires` gate.
// aoeTile skillshot. tier:'ultimate'.
const ARCANE_TINT = 0x9a7bff

export default class TheUnraveling extends Ability {
    name = 'The Unraveling'
    icon = 31
    description = 'Unmake a wide area (range 7): magicPower + 22..32 arcane damage to everything caught. 1 AP, cd 12.'
    cost = { ap: 1, mp: 0 }
    cooldown = 12
    range = 7
    target = 'aoeTile'
    tier = 'ultimate'
    radius = 3
    shape = { kind: 'circle', radius: 3 }
    fxColor = ARCANE_TINT

    damageMin = 22
    damageMax = 32
    damageStat = 'magicPower'
    damageType = 'magic'

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 6; a.damageMax += 8 },
    }

    augments = {
        cataclysmic: { label: 'Cataclysmic', apply: a => { a.damageMin += 10; a.damageMax += 14 } },
        wide:        { label: 'Wide', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        swift:       { label: 'Swift', apply: a => { a.cooldown = Math.max(0, a.cooldown - 3) } },
    }

    traits = {
        empowered: empowered(8),
        enlarge:   enlarge(1),
        quickened: quickened(2),
    }

    activate(hero, target) {
        return areaStrike(this, hero, target.tile, { splash: true })
    }
}
