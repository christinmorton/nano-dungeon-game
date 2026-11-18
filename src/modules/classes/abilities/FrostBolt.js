import Ability from './Ability.js'
import { bolt } from '../../abilities/patterns.js'
import slow from '../../tags/slow.js'

// Ice damage — a lance of ice at a picked enemy: magicPower-scaled damage + Slow.
// The Ice tree's reliable filler (the soft-CC bolt; Ice Shard is the hard-CC one).
// Delivery = patterns.bolt. Display name "Rime Lance" (locked rename ←Frost Bolt).
// Class kept FrostBolt to avoid registry churn.

const ICE_TINT = 0x6ab8ff
const ICE_PROJECTILE_TILE = 574

export default class FrostBolt extends Ability {
    name = 'Rime Lance'
    icon = 12
    description = 'A lance of ice at an enemy (range 5): 1.8x spell power + 4..8 damage and Slow. 1 AP, cd 2.'
    cost = { ap: 1, mp: 0 }
    cooldown = 2
    range = 5
    target = 'pickEnemy'

    // Rescaled 2026-10-04 (scope doc §10.16): was magicPower + 2..5, which at
    // Magic 15 read 17-20 — the Wizard's basic scroll attack with a Slow on it.
    damageScale = 1.8
    damageMin = 4
    damageMax = 8
    damageStat = 'magicPower'
    element = 'ice'           // an ice rod or tome empowers this (§10.16)
    damageType = 'magic'
    appliesStatus = slow
    fxColor = ICE_TINT

    activate(hero, target) {
        bolt(this, hero, target.entity, {
            castType: 'frost',
            projectile: { attackTile: ICE_PROJECTILE_TILE, tint: ICE_TINT },
        })
    }
}
