import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { slam } from '../../abilities/patterns.js'

// Warrior A — positioning. Drive an adjacent enemy back; if it collides with a
// wall, an object or another body on the way, it is STUNNED. In open floor it
// just slides, so the skill is reading the room and aiming a target into
// something solid.
//
// This is the Warrior's fifth kit slot. v3 put Breach there — shoulder through a
// wall into the space beyond — which is built on the destructible-terrain
// primitive cut in scope doc §6 (isBreachableWallAt / isSturdyWallAt /
// blockingStructureAt) plus a `daze` tag v5 does not carry. Restoring it meant
// restoring a terrain system for one ability.
//
// Shove was chosen over the rest of v3's Warrior pool because it needs NO new
// status — WarCry wants `might`, Brace wants `guarded`, and Hamstring, Slash and
// ComboStrike all carry `bleed` riders, any of which would have moved a second
// cap. It also fills the hole the kit actually had: Cleave, Charge, Bulwark and
// MightyBlow are four ways to deal or absorb damage and no way to move anyone.
// Scope doc §10.6.

export default class Shove extends Ability {
    name = 'Shove'
    icon = 4
    description = 'Shove an adjacent enemy back 2 tiles. If it slams into a wall or another foe, it is stunned. 1 AP, cd 3.'
    cost = { ap: 1, mp: 0 }
    cooldown = 3
    range = 1
    target = 'pickEnemy'

    pushDistance = 2

    activate(hero, target) {
        const victim = target.entity
        if (!victim) return false
        // Direction is derived from the pair, not from an aim vector: this is a
        // pickEnemy ability, and at range 1 the sign of the delta IS the facing.
        const dx = Math.sign(victim.x - hero.x)
        const dy = Math.sign(victim.y - hero.y)
        const result = slam(victim, dx, dy, this.pushDistance)
        gameLog.log(result.collided
            ? `${hero.name} slams ${victim.name} into the wall.`
            : `${hero.name} shoves ${victim.name} back.`)
        return result
    }
}
