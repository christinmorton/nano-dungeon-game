import Ability from './Ability.js'
import { areaStrike } from '../../abilities/patterns.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// GOD / ASCENDED tree (§6.8) — Cataclysm. A reality-tearing detonation over a wide
// area: catastrophic magic damage to everything caught. The rule-breaking apex
// nuke — the biggest single blast in the game. Heavily gated (god-tier attunement)
// and slow. Delivery = patterns.areaStrike (large circle). Library/unslotted.

const GOD_TINT = 0xfff0a0

export default class Cataclysm extends Ability {
    name = 'Cataclysm'
    icon = 31
    description = 'Tear reality open over a wide area (range 7): magicPower + 30..45 damage to everything caught. 1 AP, cd 10.'
    cost = { ap: 1, mp: 0 }
    cooldown = 10
    range = 7
    target = 'aoeTile'
    radius = 3
    shape = { kind: 'circle', radius: 3 }
    fxColor = GOD_TINT
    requires = { Magic: 45 }

    damageMin = 30
    damageMax = 45
    damageStat = 'magicPower'
    damageType = 'magic'

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = { 2: a => { a.radius += 1; a.shape.radius += 1 } }

    augments = {
        apocalypse: { label: 'Apocalypse', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        annihilate: { label: 'Annihilate', apply: a => { a.damageMin += 15; a.damageMax += 20 } },
        swift:      { label: 'Swift', apply: a => { a.cooldown = Math.max(0, a.cooldown - 3) } },
    }

    traits = {
        empowered: empowered(10),
        enlarge:   { label: 'Enlarge', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        quickened: quickened(2),
    }

    activate(hero, target) {
        return areaStrike(this, hero, target.tile, { splash: true })
    }
}
