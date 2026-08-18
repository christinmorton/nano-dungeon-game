import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { control } from '../../abilities/patterns.js'
import fear from '../../tags/fear.js'
import weaken from '../../tags/weaken.js'
import { reaching, quickened } from '../../abilities/traitDefs.js'

// Void control — grip an enemy with DREAD: no damage, but it FLEES from you for a
// few turns (Fear). The Void caster's will-breaker — peel a dangerous foe off the
// line and buy space to drain or finish another. Composes the `control` pattern
// (mind-control machinery: sets _controlSource, the flight runs in archetypes/
// mindControl.js). The Terrifying augment also Weakens the routed foe. Library/
// unslotted (Void).

const DREAD_TINT = 0x6a2a8a
const DREAD_PROJECTILE_TILE = 567

export default class Dread extends Ability {
    name = 'Dread'
    icon = 31
    description = 'Grip an enemy with dread (range 5) — it flees from you for 3 turns (Fear). 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'pickEnemy'
    fxColor = DREAD_TINT
    appliesStatus = fear

    fearTurns = 3
    terrifying = false         // augment: also Weaken the routed foe

    // --- Progression ladder ----------------------------------------------------
    //   L1 : flee 3 turns
    //   L2 : +1 fear turn                                                  [boost]
    //   L3 : augment — Lingering (+turns) | Terrifying (+Weaken) | Far Dread (+range)
    //   L4 : a trait slot — Reaching | Quickened | Harrowing (+turns)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.fearTurns += 1 },
    }

    augments = {
        lingering:  { label: 'Lingering',  apply: a => { a.fearTurns += 2 } },
        terrifying: { label: 'Terrifying', apply: a => { a.terrifying = true } },
        farDread:   { label: 'Far Dread',  apply: a => { a.range += 3 } },
    }

    traits = {
        reaching:  reaching(2),
        quickened: quickened(1),
        harrowing: { label: 'Harrowing', apply: a => { a.fearTurns += 1 } },
    }

    activate(hero, target) {
        const victim = target.entity
        const did = control(this, hero, victim, {
            status: fear,
            turns: this.fearTurns,
            castType: 'arcane',
            projectile: { attackTile: DREAD_PROJECTILE_TILE, tint: this.fxColor },
            instant: false,
        })
        if (did && this.terrifying && victim.sprite) {
            victim.addTag(weaken, this.fearTurns, 2)
            gameLog.log(`${victim.name} is unmanned by terror.`)
        }
        return did
    }
}
