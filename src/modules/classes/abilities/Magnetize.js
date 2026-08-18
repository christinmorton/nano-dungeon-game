import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import mapState from '../../MapState.js'
import { knockback } from '../../abilities/universals.js'
import { playBurst } from '../../Animations.js'
import { quickened, bump } from '../../abilities/traitDefs.js'

// Storm utility / control — magnetize a point and YANK every enemy around it
// inward, bunching a scattered pack onto one spot — set up for Thunderhead /
// Call Storm / a nova. Battlefield manipulation, no damage. Targets a tile
// (aoeTile); each enemy in radius is knocked TOWARD the center. Library/unslotted.

const STORM_TINT = 0x88ccff

export default class Magnetize extends Ability {
    name = 'Magnetize'
    icon = 31
    description = 'Magnetize a point (range 6): yank every enemy within 2 tiles of it toward the spot, bunching a pack up for an AoE. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 6
    radius = 2
    target = 'aoeTile'
    pullDist = 2
    fxColor = STORM_TINT

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 gather, pull 2 tiles
    //   L2 : pull 3 tiles                                                  [boost]
    //   L3 : augment — Strong Pull (+pull) | Wide Pull (+radius) | Far Reach (+range)
    //   L4 : a trait slot — Strong (+pull) | Wide (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.pullDist += 1 },
    }

    augments = {
        strong:   { label: 'Strong Pull', apply: a => { a.pullDist += 2 } },
        wide:     { label: 'Wide Pull', apply: a => { a.radius += 1 } },
        farReach: { label: 'Far Reach', apply: a => { a.range += 3 } },
    }

    traits = {
        strong:    bump('Strong', 'pullDist', 1),
        wide:      bump('Wide', 'radius', 1, 0),
        quickened: quickened(1),
    }

    activate(hero, target) {
        const c = target.tile
        playBurst(c.x, c.y, { radius: this.radius, color: this.fxColor })
        // Collect first so a pulled enemy isn't re-processed when it lands on a
        // not-yet-scanned tile.
        const enemies = []
        for (let dy = -this.radius; dy <= this.radius; dy++) {
            for (let dx = -this.radius; dx <= this.radius; dx++) {
                if (dx === 0 && dy === 0) continue
                const e = mapState.entityAtTile(c.x + dx, c.y + dy)
                if (e && e.type === 'enemy') enemies.push(e)
            }
        }
        for (const e of enemies) {
            const sx = Math.sign(c.x - e.x)
            const sy = Math.sign(c.y - e.y)
            if (sx || sy) knockback(e, sx, sy, this.pullDist)
        }
        gameLog.log(enemies.length
            ? `${hero.name} magnetizes ${enemies.length} ${enemies.length === 1 ? 'enemy' : 'enemies'} inward.`
            : `${hero.name} magnetizes the air.`)
        return true
    }
}
