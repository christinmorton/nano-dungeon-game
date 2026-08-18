import Ability from './Ability.js'
import { groundZone } from '../../abilities/patterns.js'
import { enlarge, quickened, bump } from '../../abilities/traitDefs.js'

// Wind support — raise a swirling gale-totem over an area: a buff-ZONE that grants
// Evasion (a dodge spike) to allies standing in it each round — the PARTY version
// of Wind Ward, the way Earth's Ward Stone is the party Stoneskin/Guarded. Stand
// the group in it to weather a volley. A groundZone buff-zone (built for Ward
// Stone); affects 'hero' today (team-aware ally support is a follow-up).
// Library/unslotted.

const WIND_TINT = 0xbfe0ff

export default class GaleTotem extends Ability {
    name = 'Gale Totem'
    icon = 31
    description = 'Raise a gale over an area (range 5): you (and allies) standing in it gain Evasion — a dodge spike — each round. Party defense vs a volley. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 5
    target = 'aoeTile'
    radius = 1
    fxColor = WIND_TINT

    zoneDuration = 5

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1 },
    }

    augments = {
        wide:     { label: 'Wide Gale', apply: a => { a.radius += 1 } },
        enduring: { label: 'Enduring Gale', apply: a => { a.zoneDuration += 4 } },
        swift:    { label: 'Swift Gale', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        enlarge:   enlarge(1),
        lasting:   bump('Lasting', 'zoneDuration', 2),
        quickened: quickened(1),
    }

    activate(hero, target) {
        return groundZone(this, hero, target.tiles, {
            kind: 'wind',
            duration: this.zoneDuration,
            damage: null,
            onTick: ['Evasion'],
            onEnter: ['Evasion'],
            affects: 'hero',
        })
    }
}
