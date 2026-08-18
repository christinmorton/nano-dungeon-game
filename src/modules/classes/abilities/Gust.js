import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import mapState from '../../MapState.js'
import dungeon from '../../Dungeon.js'
import { knockback } from '../../abilities/universals.js'
import { playCast } from '../../Animations.js'
import { hazardsAt } from '../../hazards/Hazards.js'
import { shapeOffsets } from '../../abilities/shapes.js'
import { wide, quickened, bump } from '../../abilities/traitDefs.js'

// Wind world-interaction — blast a gust of wind in a cone: it shoves enemies and
// loose props back AND blows OUT hazard zones in its path (snuff a fire field,
// scatter a gas/smoke cloud). No damage — pure utility/control. The "manipulate
// the environment with air" tool. Reuses knockback + the hazard system
// (ZoneEffect's expire path = "blown out"). Library/unslotted.

const WIND_TINT = 0xcfe8ff

export default class Gust extends Ability {
    name = 'Gust'
    icon = 31
    description = 'Blast a gust in a cone: shove enemies and loose objects back, and blow out hazards (snuff fires, scatter clouds). 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 3
    target = 'direction'
    shape = { kind: 'cone', length: 3, spread: 1 }
    fxColor = WIND_TINT
    pushDist = 2

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.shape.length += 1 },
    }

    augments = {
        strong:   { label: 'Strong Gust', apply: a => { a.pushDist += 2 } },
        wideGust: { label: 'Wide Gust', apply: a => { a.shape.spread += 1 } },
        longGust: { label: 'Long Gust', apply: a => { a.shape.length += 1 } },
    }

    traits = {
        forceful:  bump('Forceful', 'pushDist', 1),
        wide:      wide(1),
        quickened: quickened(1),
    }

    activate(hero, target) {
        const dx = target.dx, dy = target.dy
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        const offsets = shapeOffsets(this.shape, dx, dy)
        const enemies = []   // collect first — knockback moves them
        let touched = 0
        for (const off of offsets) {
            const tx = hero.x + off.dx
            const ty = hero.y + off.dy
            if (mapState.level?.[ty]?.[tx] !== 0) continue
            // Blow out any hazard zone on the tile (reuses the zone expire path).
            for (const h of hazardsAt(tx, ty)) { if (typeof h.freeze === 'function') { h.freeze(); touched++ } }
            const e = mapState.entityAtTile(tx, ty)
            if (e && e.type === 'enemy') {
                enemies.push(e)
            } else if (e && e.type === 'prop') {
                const px = tx + dx, py = ty + dy
                if (mapState.isWalkableTile(px, py)) { e.x = px; e.y = py; dungeon.moveEntityTo(e, px, py); touched++ }
            }
        }
        for (const e of enemies) { knockback(e, dx, dy, this.pushDist); touched++ }
        gameLog.log(touched ? `${hero.name}'s gust sweeps the area.` : `${hero.name} blows a gust of wind.`)
        return true
    }
}
