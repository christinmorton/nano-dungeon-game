import Ability from './Ability.js'
import { areaStrike } from '../../abilities/patterns.js'
import slow from '../../tags/slow.js'
import rimesBite from '../../tags/rimesBite.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// FUSION (Ice + Wind) — Blizzard. A howling whiteout over an area: cold damage to
// every enemy caught, Slowed by the driving wind and left with Rime's Bite (the
// cold DoT gnawing through the chill). Ice's lockdown fused with Wind's reach —
// area control + attrition. ADVANCED / higher-tier. Delivery = patterns.areaStrike
// (circle); both statuses ride the declarative appliesStatus (like Frost Tomb).
// Library/unslotted.

const ICE_TINT = 0x9fd8ff

export default class Blizzard extends Ability {
    name = 'Blizzard'
    icon = 31
    description = 'Whip a howling blizzard over an area (range 6): magicPower + 7..12 cold damage, Slow + Rime’s Bite to all caught. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 6
    target = 'aoeTile'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = ICE_TINT
    requires = { Magic: 14 }

    damageMin = 7
    damageMax = 12
    damageStat = 'magicPower'
    damageType = 'magic'
    appliesStatus = [slow, rimesBite]

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 · cold+7..12 · Slow + Rime's Bite
    //   L2 : +1 radius                                                     [boost]
    //   L3 : augment — Whiteout (+radius) | Deep Chill (+damage) | Rapid Cast (cd -1)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1; a.shape.radius += 1 },
    }

    augments = {
        whiteout:  { label: 'Whiteout', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        deepChill: { label: 'Deep Chill', apply: a => { a.damageMin += 4; a.damageMax += 6 } },
        rapid:     { label: 'Rapid Cast', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        empowered: empowered(4),
        enlarge:   { label: 'Enlarge', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        quickened: quickened(1),
    }

    activate(hero, target) {
        return areaStrike(this, hero, target.tile, { splash: true })
    }
}
