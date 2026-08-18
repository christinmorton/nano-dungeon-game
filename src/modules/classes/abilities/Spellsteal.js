import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { castSpell } from '../../abilities/universals.js'
import { positiveStatusesOn, getStatusTemplate } from '../../tags/Status.js'
import { reaching, quickened, efficient } from '../../abilities/traitDefs.js'

// Arcane control — the DUELIST'S tool. Rip a buff off an enemy and bind it to
// yourself: strip one positive status and graft it onto the caster. Pure
// anti-magic — USELESS against an unbuffed foe (a brute with no buffs gives
// nothing), so it shines mage-vs-mage. Fizzles + refunds when there's nothing to
// take. Library/unslotted.
//
// PARKED variants (user, 2026-06-24): a corrupted version that steals base STATS
// for a short time, and a possible ABILITY-theft (e.g. lift Dig) — both need
// activate-side logic, deferred. A "steal ALL buffs" augment is the same.

const STEAL_TINT = 0xc084fc
const STEAL_PROJECTILE_TILE = 567

export default class Spellsteal extends Ability {
    name = 'Spellsteal'
    icon = 31
    description = "Rip a buff off an enemy and bind it to yourself (range 5). Useless vs an unbuffed foe. 1 AP, cd 5."
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 5
    target = 'pickEnemy'
    fxColor = STEAL_TINT

    // --- Progression ladder (range / tempo — theft logic lives in activate) -----
    //   L1 : range 5, cd 5
    //   L2 : cd -1                                                         [boost]
    //   L3 : augment — Far Theft (+range) | Swift Theft (cd -2) | Effortless (0 AP)
    //   L4 : a trait slot — Reaching | Quickened | Efficient
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.cooldown = Math.max(0, a.cooldown - 1) },
    }

    augments = {
        farTheft:   { label: 'Far Theft', apply: a => { a.range += 3 } },
        swiftTheft: { label: 'Swift Theft', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
        effortless: { label: 'Effortless Theft', apply: a => { a.cost = { ...a.cost, ap: 0 } } },
    }

    traits = {
        reaching:  reaching(2),
        quickened: quickened(1),
        efficient: efficient({ ap: 1 }),
    }

    activate(hero, target) {
        const victim = target.entity
        // Fizzle + refund before the cast if there's nothing magical to take —
        // this is what makes it a deliberate anti-buff tool, not a generic poke.
        if (positiveStatusesOn(victim).length === 0) {
            gameLog.log(`${victim.name} has no magic to steal.`)
            return false
        }
        castSpell(hero, victim, {
            castType: 'arcane',
            projectile: { attackTile: STEAL_PROJECTILE_TILE, tint: STEAL_TINT },
            onImpact: (v) => {
                if (!v.sprite) return
                const buffs = positiveStatusesOn(v)        // re-read on impact (defensive)
                if (!buffs.length) return
                const meta = buffs[0]                       // steal the first-applied buff
                const template = getStatusTemplate(meta.name)
                if (!template) return
                v.removeTag(template)                       // strip from the victim (+ its cleanup)
                hero.addTag(template)                       // graft onto the caster (re-inits fresh)
                gameLog.log(`${hero.name} steals ${meta.name} from ${v.name}!`)
            }
        })
        return true
    }
}
