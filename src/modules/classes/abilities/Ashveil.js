import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import evasion from '../../tags/evasion.js'
import { groundZone } from '../../abilities/patterns.js'
import { teleport } from '../../abilities/universals.js'
import { footprintTiles } from '../../hazards/Hazards.js'

// Elf / skirmisher — the vanishing act. Burst a veil of ash where you stand to
// cover your departure, then slip to a chosen tile and break away evasive: enemies
// lose the bead on you for a beat. The skirmisher's reposition-under-cover.
//
// NOTE: the smoke is a concealment cloud + the slip + a brief Evasion for now; true
// line-of-sight blocking (smoke tiles occluding enemy archer/caster aim, via the
// projectile-occlusion system) is a deferred refinement. Library/unslotted.

export default class Ashveil extends Ability {
    name = 'Ashveil'
    icon = 31
    description = 'Drop a veil of ash where you stand and slip to a nearby tile, landing evasive. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 4
    target = 'pickTile'

    fxColor = 0x9aa0a6          // ash grey (matches the ZoneEffect 'smoke' style)

    evasionTurns = 2
    evasionAmount = 6

    activate(hero, target) {
        // Veil where you're leaving FROM (covers the retreat), then slip away.
        groundZone(this, hero, footprintTiles(hero.x, hero.y, 1), {
            kind: 'smoke',
            duration: 3,
            affects: 'all',
        })
        teleport(hero, target.tile.x, target.tile.y)
        hero.addTag(evasion, this.evasionTurns, this.evasionAmount)
        gameLog.log(`${hero.name} vanishes into a veil of ash.`)
        return true
    }
}
