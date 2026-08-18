import Ability from './Ability.js'
import { rangedRain, lingeringRain } from '../../abilities/ranged.js'
import { playAreaOutline } from '../../Animations.js'
import { quickened } from '../../abilities/traitDefs.js'

// Elf ULTIMATE — Rain of Talons. The skirmisher's apex skillshot: a sustained storm
// of arrows over a WIDE area that rains for several rounds — like Arrow Storm but
// bigger, longer, and full-power. Weapon-delegated (needs a bow); each arrow is a
// full bow hit. tier:'ultimate'.

// Grow the footprint AND its aoeTile preview together (see ArrowStorm).
function grow(a, n) { a.shape.radius += n; a.radius += n }

export default class RainOfTalons extends Ability {
    name = 'Rain of Talons'
    icon = 31
    description = 'Blanket a wide area in a sustained arrow storm — it rains for several rounds, hitting every enemy under it each round. 1 AP, cd 12. Requires a ranged weapon.'
    cost = { ap: 1, mp: 0 }
    cooldown = 12
    range = 7
    target = 'aoeTile'
    tier = 'ultimate'

    shape = { kind: 'circle', radius: 3 }
    radius = 3

    damageType = 'physical'
    damageMult = 1.0
    bonusDamage = 0
    knockbackTiles = 0
    fxColor = 0xffcc66

    // Rains for this many EXTRA rounds after the cast volley.
    lingerRounds = 3

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.lingerRounds += 1 },
        3: a => { grow(a, 1) },
        4: a => { a.lingerRounds += 1 },
    }

    augments = {
        torrential: { label: 'Torrential', apply: a => { a.lingerRounds += 2 } },
        cloudburst: { label: 'Cloudburst', apply: a => { grow(a, 1) } },
        swift:      { label: 'Swift', apply: a => { a.cooldown = Math.max(0, a.cooldown - 3) } },
    }

    traits = {
        quickened: quickened(2),
    }

    activate(hero, target) {
        const tile = target.tile
        const border = playAreaOutline(tile.x, tile.y, this.shape, {
            color: this.fxColor, pulse: true, fade: 0,
        })
        const hits = rangedRain(this, hero, tile)
        if (this.lingerRounds > 0) lingeringRain(this, hero, tile, this.lingerRounds, border)
        return hits
    }
}
