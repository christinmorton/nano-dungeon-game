import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { shapeStrike } from '../../abilities/patterns.js'
import stasis from '../../tags/stasis.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Time tree — TIME STOP: freeze every enemy around you in time (Stasis — they can
// neither move nor act). No damage; pure lockdown. The self-centered AoE control
// nova (the time twin of Earth's Tremor / Ice's Hoarfrost). Delivery =
// patterns.shapeStrike + circle; Stasis applied explicitly to each enemy in the
// ring so the ladder can scale its duration. Library/unslotted.

const TIME_TINT = 0xbfe6ff

export default class Stasis extends Ability {
    name = 'Stasis'
    icon = 31
    description = 'Stop time around you: freeze all enemies within 2 tiles in Stasis (skip turns) for 2 turns. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 2
    target = 'self'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = TIME_TINT

    damageMin = 0              // pure CC — no damage
    damageMax = 0
    damageType = 'magic'

    stasisTurns = 2

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 nova · Stasis 2 turns
    //   L2 : +1 stasis turn                                                [boost]
    //   L3 : augment — Wide (+radius) | Lasting (+turns) | Rapid (cd -1)
    //   L4 : a trait slot — Enlarge (+radius) | Lasting (+turns) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.stasisTurns += 1 },
    }

    augments = {
        wide:    { label: 'Wide',    apply: a => { a.radius += 1; a.shape.radius += 1 } },
        lasting: { label: 'Lasting', apply: a => { a.stasisTurns += 1 } },
        rapid:   { label: 'Rapid',   apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        enlarge:   { label: 'Enlarge', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        lasting:   bump('Lasting', 'stasisTurns', 1),
        quickened: quickened(1),
    }

    activate(hero) {
        const results = shapeStrike(this, hero, 0, 0, { splash: true })
        let held = 0
        for (const { entity, result } of results) {
            if (result.killed || !entity.sprite) continue
            entity.addTag(stasis, this.stasisTurns)
            held++
        }
        gameLog.log(held
            ? `${hero.name} stops time — ${held} ${held === 1 ? 'enemy' : 'enemies'} frozen.`
            : `${hero.name} stops time.`)
        return true
    }
}
