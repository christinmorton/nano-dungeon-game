import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { areaStrike } from '../../abilities/patterns.js'
import { resolveDamage } from '../../abilities/universals.js'
import { isUndead } from '../../enemies/enemyKinds.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// SERAPHIM tree (§6.8, apex light) — Heaven's Judgment. A pillar of holy fire
// called down on an area: massive holy damage to all caught, TRIPLED against
// undead. The seraph's verdict — the apex AoE smite. Higher-tier (heavily gated).
// Delivery = patterns.areaStrike (circle). Library/unslotted.

const LIGHT_TINT = 0xffffff

export default class HeavensJudgment extends Ability {
    name = "Heaven's Judgment"
    icon = 31
    description = 'Call down judgment on an area (range 6): magicPower + 16..24 holy damage, ×3 vs undead. 1 AP, cd 8.'
    cost = { ap: 1, mp: 0 }
    cooldown = 8
    range = 6
    target = 'aoeTile'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = LIGHT_TINT
    requires = { Magic: 35 }

    damageMin = 16
    damageMax = 24
    damageStat = 'magicPower'
    damageType = 'magic'

    undeadMult = 3

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = { 2: a => { a.radius += 1; a.shape.radius += 1 } }

    augments = {
        wide:    { label: 'Wide Judgment', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        radiant: { label: 'Radiant', apply: a => { a.damageMin += 8; a.damageMax += 10 } },
        swift:   { label: 'Swift', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        empowered: empowered(6),
        enlarge:   { label: 'Enlarge', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        quickened: quickened(1),
    }

    activate(hero, target) {
        const results = areaStrike(this, hero, target.tile, { splash: true })
        for (const { entity, result } of results) {
            if (result.killed || !isUndead(entity)) continue
            const extra = this.rollDamage(hero) * (this.undeadMult - 1)
            const bonus = resolveDamage(entity, extra, this.damageType, { aoe: true, attacker: hero })
            gameLog.log(`Judgment scours ${entity.name} for ${bonus.applied} more (×${this.undeadMult} vs undead!).`)
        }
        return results
    }
}
