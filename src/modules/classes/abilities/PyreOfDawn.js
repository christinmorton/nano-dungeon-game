import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { areaStrike } from '../../abilities/patterns.js'
import { resolveDamage } from '../../abilities/universals.js'
import { isUndead } from '../../enemies/enemyKinds.js'
import burning from '../../tags/burning.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// FUSION (Holy + Fire) — Pyre of Dawn. Consecrated flame: fire damage + Burning to
// all in the area, DOUBLED against undead (Holy's Giantslayer rider — a second
// holy strike sears the unholy). Fire's burn fused with Holy's anti-undead light —
// the cleric's answer to a graveyard horde. ADVANCED / higher-tier. Delivery =
// areaStrike (circle) + an undead-bonus rider. Library/unslotted.

const DAWN_TINT = 0xffd27a

export default class PyreOfDawn extends Ability {
    name = 'Pyre of Dawn'
    icon = 31
    description = 'Ignite a consecrated pyre on an area (range 6): magicPower + 8..13 fire damage + Burning, DOUBLED vs undead. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 6
    target = 'aoeTile'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = DAWN_TINT
    requires = { Magic: 14 }

    damageMin = 8
    damageMax = 13
    damageStat = 'magicPower'
    damageType = 'fire'
    appliesStatus = burning

    undeadMult = 2

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 · fire+8..13 + Burning · ×2 vs undead
    //   L2 : +1 radius                                                     [boost]
    //   L3 : augment — Sunburst (+radius) | Radiant (+damage) | Consecrated (×3 undead)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1; a.shape.radius += 1 },
    }

    augments = {
        sunburst:    { label: 'Sunburst', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        radiant:     { label: 'Radiant', apply: a => { a.damageMin += 5; a.damageMax += 7 } },
        consecrated: { label: 'Consecrated', apply: a => { a.undeadMult = 3 } },
    }

    traits = {
        empowered: empowered(4),
        enlarge:   { label: 'Enlarge', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        quickened: quickened(1),
    }

    activate(hero, target) {
        const results = areaStrike(this, hero, target.tile, { splash: true })
        for (const { entity, result } of results) {
            if (result.killed || !isUndead(entity)) continue
            const extra = this.rollDamage(hero) * (this.undeadMult - 1)
            const bonus = resolveDamage(entity, extra, this.damageType, { aoe: true, attacker: hero })
            gameLog.log(`Holy fire scours ${entity.name} for ${bonus.applied} more (×${this.undeadMult} vs undead!).`)
        }
        return results
    }
}
