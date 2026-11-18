import Ability from './Ability.js'
import stun from '../../tags/stun.js'
import { gapCloseStrike } from '../../abilities/patterns.js'

// Warrior W — directional charge. The composable gap-closer: gapCloseStrike
// glides up to `range` tiles (the SAME glide verb the hand-written version used,
// so the dash animation is unchanged), and if the path stops on an enemy it
// lands a WEAPON hit + knockback + the rider statuses. Damage is the weapon's
// (weapon-delegated — damageMin/Max stay 0); the ladder grows the riders.
export default class Charge extends Ability {
    name = 'Charge'
    icon = 1
    description = 'Step up to 3 tiles in a direction; attack the first enemy hit, shove them back 2 tiles, and stun for a turn. 1 AP / 2 MP, cd 4.'
    cost = { ap: 1, mp: 2 }
    cooldown = 4
    range = 3
    target = 'direction'

    // Riders on the weapon hit (read at activate time, so ladder mutations bite).
    knockbackTiles = 2
    appliesStatus = stun

    activate(hero, target) {
        const result = gapCloseStrike(this, hero, target.dx, target.dy, {
            maxSteps: this.range,
            knockbackTiles: this.knockbackTiles,
            statuses: this.appliesStatus,
        })
        if (result === false) return false   // nowhere to go — gapCloseStrike logged it
    }
}
