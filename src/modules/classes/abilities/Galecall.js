import Ability from './Ability.js'
import { aura } from '../../abilities/patterns.js'
import slow from '../../tags/slow.js'
import { empowered, quickened, bump } from '../../abilities/traitDefs.js'

// Wind `spirit` (shaman) — commune with the wind and call a CYCLONE around you: a
// sustained field that chips and Slows every enemy in radius each round for a few
// turns. The tree's area-control ultimate. Delivery = patterns.aura. Soft-gated by
// Magic (§14 B1): casters (Shaman/Wizard start Magic 15) cast it natively; others
// can earn it by investing in Magic. Library/unslotted.

const WIND_TINT = 0xbfe0ff

export default class Galecall extends Ability {
    name = 'Galecall'
    icon = 31
    description = 'Commune with the wind: a cyclone around you chips and Slows all enemies within 2 tiles each round. Needs Magic 15. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 0
    target = 'self'
    radius = 2
    cycloneTurns = 4
    requires = { Magic: 15 }
    fxColor = WIND_TINT

    damageMin = 2
    damageMax = 4
    damageStat = null
    damageType = 'magic'
    appliesStatus = slow

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 1; a.damageMax += 1 },
    }

    augments = {
        howling: { label: 'Howling', apply: a => { a.damageMin += 2; a.damageMax += 3 } },
        wide:    { label: 'Wide Cyclone', apply: a => { a.radius += 1 } },
        lasting: { label: 'Lasting', apply: a => { a.cycloneTurns += 3 } },
    }

    traits = {
        empowered: empowered(2),
        enlarge:   bump('Enlarge', 'radius', 1, 0),
        quickened: quickened(1),
    }

    activate(hero) {
        return aura(this, hero, { affects: 'enemy', turns: this.cycloneTurns, castType: 'arcane' })
    }
}
