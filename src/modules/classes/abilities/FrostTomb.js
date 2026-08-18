import Ability from './Ability.js'
import { areaStrike } from '../../abilities/patterns.js'
import freeze from '../../tags/freeze.js'
import rimesBite from '../../tags/rimesBite.js'
import { hazardsAt, footprintTiles } from '../../hazards/Hazards.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// Ice control + world-interaction — encase a target area in ice. Every enemy
// caught is FROZEN (hard CC) and left with Rime's Bite (cold DoT gnawing while
// they're locked), and any HAZARD ZONE in the area is SMOTHERED (a fire/gas field
// freezes solid — ZoneEffect.freeze). The Ice tree's signature AoE; the primary
// applier of Rime's Bite. Delivery = patterns.areaStrike (circle). Terrain
// freezing (water -> ice bridge, sealing doors) is deferred — Rime Gate is the
// dedicated pathway seal for now.

const ICE_TINT = 0x9fd8ff

export default class FrostTomb extends Ability {
    name = 'Frost Tomb'
    icon = 31
    description = 'Encase a target area in ice (range 5): magicPower + 2..4 damage, Freeze every enemy caught + Rime’s Bite, and smother any hazard there. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'aoeTile'
    radius = 1
    shape = { kind: 'circle', radius: 1 }
    fxColor = ICE_TINT

    damageMin = 2
    damageMax = 4
    damageStat = 'magicPower'
    damageType = 'magic'
    appliesStatus = [freeze, rimesBite]    // hard CC + the lingering cold DoT

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r1 tomb, magicPower + 2..4 + Freeze + Rime's Bite
    //   L2 : +1 radius                                                     [boost]
    //   L3 : augment — Deep Freeze (+dmg) | Wide Tomb (+radius) | Rapid Cast (cd -1)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1; a.shape.radius += 1 },
    }

    augments = {
        deepFreeze: { label: 'Deep Freeze', apply: a => { a.damageMin += 3; a.damageMax += 4 } },
        wide:       { label: 'Wide Tomb', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        rapid:      { label: 'Rapid Cast', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        empowered: empowered(2),
        enlarge:   { label: 'Enlarge', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        quickened: quickened(1),
    }

    activate(hero, target) {
        const results = areaStrike(this, hero, target.tile, { splash: true })
        // World-interaction: snuff any hazard zone caught in the tomb (freeze it solid).
        for (const t of footprintTiles(target.tile.x, target.tile.y, this.radius)) {
            for (const h of hazardsAt(t.x, t.y)) h.freeze?.()
        }
        return results
    }
}
