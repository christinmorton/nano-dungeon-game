import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import mapState from '../../MapState.js'
import { playCast } from '../../Animations.js'
import { teleport, heal } from '../../abilities/universals.js'
import guarded from '../../tags/guarded.js'

// Spatial tree — RECALL: a two-tap escape/explore tool. Tap once to plant a spatial
// ANCHOR on your tile; tap again (any time later) to teleport back to it. Scout a
// dangerous room and snap home if it goes wrong, or mark a safe corner before a
// fight. The escape pillar of the traversal kit. Self-target; stores one anchor.
// Augments add a benefit on return (heal / ward). Library/unslotted (Spatial).

const SPATIAL_TINT = 0x9a7bff

export default class Recall extends Ability {
    name = 'Recall'
    icon = 31
    description = 'Tap to plant a spatial anchor; tap again to teleport back to it. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 0
    target = 'self'
    fxColor = SPATIAL_TINT

    returnHeal = 0             // augment: heal on return
    returnWard = false         // augment: Guarded on return

    // --- Progression ladder ----------------------------------------------------
    //   L1 : plant / return
    //   L2 : -1 cooldown                                                   [boost]
    //   L3 : augment — Restoring (heal on return) | Warded (Guarded on return) | Swift (cd -2)
    //   L4 : a trait slot — Restoring (+heal) | Quickened | Efficient
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.cooldown = Math.max(0, a.cooldown - 1) },
    }

    augments = {
        restoring: { label: 'Restoring', apply: a => { a.returnHeal += 12 } },
        warded:    { label: 'Warded',    apply: a => { a.returnWard = true } },
        swift:     { label: 'Swift',     apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        restoring: { label: 'Restoring', apply: a => { a.returnHeal += 8 } },
        quickened: { label: 'Quickened', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
        efficient: { label: 'Efficient', apply: a => { a.cost = { ...a.cost, ap: Math.max(0, (a.cost.ap ?? 0) - 1) } } },
    }

    activate(hero) {
        // No anchor yet → plant one on the current tile.
        if (!this._anchor) {
            this._anchor = { x: hero.x, y: hero.y }
            playCast(hero, { type: 'arcane', tint: this.fxColor })
            gameLog.log(`${hero.name} plants a spatial anchor.`)
            return true
        }
        // Anchor set → return to it (if the tile is clear), then consume the anchor.
        const { x, y } = this._anchor
        const occupant = mapState.entityAtTile(x, y)
        if (occupant && occupant !== hero) {
            gameLog.log(`The anchor point is blocked — Recall fizzles.`)
            this._anchor = null
            return false
        }
        teleport(hero, x, y)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        if (this.returnHeal > 0) heal(hero, this.returnHeal)
        if (this.returnWard) hero.addTag(guarded)
        this._anchor = null
        gameLog.log(`${hero.name} recalls to the anchor.`)
        return true
    }
}
