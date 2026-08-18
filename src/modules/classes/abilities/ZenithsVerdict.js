import Ability from './Ability.js'
import tm from '../../TurnManager.js'
import gameLog from '../../GameLog.js'
import { shapeStrike } from '../../abilities/patterns.js'
import { heal } from '../../abilities/universals.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// Cleric ULTIMATE — Zenith's Verdict. A holy reckoning: a radiant blast that smites
// every enemy around the cleric AND restores the whole party (caster + allies in the
// same radius) in one stroke. The survival capstone — burst + party heal together.
// Self-centered. tier:'ultimate'.
const HOLY_TINT = 0xffe39a

export default class ZenithsVerdict extends Ability {
    name = "Zenith's Verdict"
    icon = 31
    description = 'Pronounce a holy reckoning: magicPower + 14..22 damage to all nearby enemies, and heal yourself and nearby allies for magicPower + 12. 1 AP, cd 12.'
    cost = { ap: 1, mp: 0 }
    cooldown = 12
    range = 3
    target = 'self'
    tier = 'ultimate'
    radius = 3
    shape = { kind: 'circle', radius: 3 }
    fxColor = HOLY_TINT

    damageMin = 14
    damageMax = 22
    damageStat = 'magicPower'
    damageType = 'magic'

    healBase = 12

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 4; a.damageMax += 6; a.healBase += 4 },
    }

    augments = {
        reckoning:  { label: 'Reckoning', apply: a => { a.damageMin += 8; a.damageMax += 10 } },
        benevolent: { label: 'Benevolent', apply: a => { a.healBase += 10 } },
        wide:       { label: 'Wide', apply: a => { a.radius += 1; a.shape.radius += 1 } },
    }

    traits = {
        empowered: empowered(6),
        quickened: quickened(2),
    }

    activate(hero) {
        const result = shapeStrike(this, hero, 0, 0, { splash: true })
        // Party heal: top up the caster + allies within the same radius.
        const amount = this.healBase + hero.stat('magicPower')
        let healed = 0
        for (const e of tm.entities) {
            if (!e || e === hero || !e.sprite) continue
            if (e.team !== hero.team) continue
            const d = Math.max(Math.abs(e.x - hero.x), Math.abs(e.y - hero.y))
            if (d <= this.radius && heal(e, amount) > 0) healed++
        }
        heal(hero, amount)
        gameLog.log(healed
            ? `${hero.name} pronounces judgment — ${healed} ally restored.`
            : `${hero.name} pronounces judgment.`)
        return result
    }
}
