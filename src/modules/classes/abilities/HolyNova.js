import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { shapeStrike } from '../../abilities/patterns.js'
import { resolveDamage, heal } from '../../abilities/universals.js'
import { isUndead } from '../../enemies/enemyKinds.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// HOLY ANGEL tree (§6.8) — Holy Nova. A radiant burst around the angel: holy
// damage to every enemy in the ring (DOUBLED vs undead), and the light mends the
// caster. The Angel tree's signature AoE. Higher-tier (gated, big). Self-centered
// nova via shapeStrike + circle. Library/unslotted.

const HOLY_TINT = 0xffe9a0

export default class HolyNova extends Ability {
    name = 'Holy Nova'
    icon = 31
    description = 'Erupt with holy light: magicPower + 12..18 to all enemies within 2 (×2 undead) and heal yourself. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 2
    target = 'self'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = HOLY_TINT
    requires = { Magic: 25 }

    damageMin = 12
    damageMax = 18
    damageStat = 'magicPower'
    damageType = 'magic'

    undeadMult = 2
    selfHeal = 15

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = { 2: a => { a.radius += 1; a.shape.radius += 1 } }

    augments = {
        wide:        { label: 'Greater Nova', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        radiant:     { label: 'Radiant', apply: a => { a.damageMin += 6; a.damageMax += 8 } },
        consecrated: { label: 'Consecrated', apply: a => { a.undeadMult = 3; a.selfHeal += 10 } },
    }

    traits = {
        empowered: empowered(5),
        blessed:   { label: 'Blessed', apply: a => { a.selfHeal += 8 } },
        quickened: quickened(1),
    }

    activate(hero) {
        const results = shapeStrike(this, hero, 0, 0, { splash: true })
        for (const { entity, result } of results) {
            if (result.killed || !isUndead(entity)) continue
            const extra = this.rollDamage(hero) * (this.undeadMult - 1)
            resolveDamage(entity, extra, this.damageType, { aoe: true, attacker: hero })
        }
        const mended = heal(hero, this.selfHeal)
        if (mended) gameLog.log(`${hero.name} is mended by the light (${mended}).`)
        return results
    }
}
