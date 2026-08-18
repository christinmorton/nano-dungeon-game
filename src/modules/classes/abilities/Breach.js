import Ability from './Ability.js'
import mapState from '../../MapState.js'
import gameLog from '../../GameLog.js'
import stun from '../../tags/stun.js'
import { teleport } from '../../abilities/universals.js'
import { gapCloseStrike } from '../../abilities/patterns.js'
import { applyDaze } from '../../tags/daze.js'

// Breach — a STRENGTH-gated terrain ability: shoulder through one shallow wall to
// the open space beyond. It interacts with terrain first; a body in the path turns
// it into a Charge instead. Phases through ordinary dungeon walls (level === 1, not
// sturdy) and opposing wall segments, but NOT locked doors or sturdy/story walls.
// If there's no open room on the far side (solid rock / the void) it just slams the
// wall — a chance to daze the caster. Warrior/Dwarf only (STR + CON gate). Unslotted.
const SELF_DAZE_CHANCE = 0.34

export default class Breach extends Ability {
    name = 'Breach'
    icon = 31
    description = 'Shoulder through one adjacent shallow wall to the open tile beyond — or Charge an enemy in the way. Bounces (may daze you) off solid rock; can’t breach doors or sturdy walls. 1 AP / 1 MP, cd 7.'
    cost = { ap: 1, mp: 1 }
    cooldown = 7
    range = 2
    target = 'direction'
    requires = { STR: 13, CON: 12 }   // a strength-AND-body gate — Warrior/Dwarf only

    // Charge-branch riders (used only when Breach connects with an enemy).
    knockbackTiles = 2
    appliesStatus = stun

    activate(hero, target) {
        const { dx, dy } = target
        const wallX = hero.x + dx
        const wallY = hero.y + dy
        const beyondX = hero.x + dx * 2
        const beyondY = hero.y + dy * 2

        // Doors are opened, not breached.
        if (mapState.isDoorAt(wallX, wallY)) {
            gameLog.log(`${hero.name} can't breach a door — open it instead.`)
            return false
        }
        // Sturdy / story walls won't give — you bounce off (chance to self-daze).
        if (mapState.isSturdyWallAt(wallX, wallY)) {
            gameLog.log(`${hero.name} slams into the sturdy wall — it doesn't budge.`)
            this._maybeSelfDaze(hero)
            return   // action is spent: committing to the slam is the cost
        }

        const adjacentIsWall = mapState.isBreachableWallAt(wallX, wallY)
            || !!mapState.blockingStructureAt(wallX, wallY, hero)

        if (adjacentIsWall) {
            // Phase through only if the far side is genuinely open room — otherwise
            // it's solid rock / the void and you just slam the wall.
            const roomBeyond = mapState.isWalkableTile(beyondX, beyondY)
                && !mapState.entityAtTile(beyondX, beyondY)
                && !mapState.blockingStructureAt(beyondX, beyondY, hero)
                && !mapState.isSturdyWallAt(beyondX, beyondY)
            if (!roomBeyond) {
                gameLog.log(`${hero.name} shoulders the wall, but there's only solid rock beyond.`)
                this._maybeSelfDaze(hero)
                return   // spent: committed to the slam
            }
            gameLog.log(`${hero.name} shoulder-charges through the wall.`)
            teleport(hero, beyondX, beyondY)
            return
        }

        // No wall in front: if an enemy is in the path, Breach becomes a Charge.
        if (this._enemyAhead(hero, dx, dy)) {
            const result = gapCloseStrike(this, hero, dx, dy, {
                maxSteps: this.range,
                knockbackTiles: this.knockbackTiles,
                statuses: this.appliesStatus,
            })
            if (result === false) return false
            return
        }

        gameLog.log(`${hero.name} finds nothing to breach.`)
        return false
    }

    // First enemy along (dx, dy) within range, stopping the scan at a wall/structure.
    _enemyAhead(hero, dx, dy) {
        for (let i = 1; i <= this.range; i++) {
            const tx = hero.x + dx * i
            const ty = hero.y + dy * i
            const entity = mapState.entityAtTile(tx, ty)
            if (entity && entity.type === 'enemy') return entity
            if (mapState.level?.[ty]?.[tx] === 1) break
            if (mapState.blockingStructureAt(tx, ty, hero)) break
        }
        return null
    }

    _maybeSelfDaze(hero) {
        if (Math.random() < SELF_DAZE_CHANCE) applyDaze(hero)
    }
}
