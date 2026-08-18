import Ability from './Ability.js'
import { aura } from '../../abilities/patterns.js'
import { empowered, quickened, bump } from '../../abilities/traitDefs.js'

// Storm defense — wreathe yourself in crackling current: a sustained AURA that
// shocks every enemy within radius each round for a few turns (so any melee
// attacker that closes in gets zapped). The proactive defensive field, vs the
// wards' on-hit retaliation. Delivery = patterns.aura (continuous emanation).
// Library/unslotted.

const STORM_TINT = 0x66aaff

export default class ArcField extends Ability {
    name = 'Arc Field'
    icon = 31
    description = 'Wreathe yourself in current: shock all enemies within 1 tile each round for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    radius = 1
    fieldTurns = 4
    fxColor = STORM_TINT

    // Flat per-round shock (no magicPower scale — it's multi-hit per round per enemy).
    damageMin = 2
    damageMax = 4
    damageStat = null
    damageType = 'magic'

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r1 field, 2..4/round, 4 turns
    //   L2 : +1/+1 damage                                                  [boost]
    //   L3 : augment — Overcharged (+dmg) | Wide Field (+radius) | Lasting Field (+turns)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 1; a.damageMax += 1 },
    }

    augments = {
        overcharged: { label: 'Overcharged', apply: a => { a.damageMin += 2; a.damageMax += 3 } },
        wide:        { label: 'Wide Field', apply: a => { a.radius += 1 } },
        lasting:     { label: 'Lasting Field', apply: a => { a.fieldTurns += 3 } },
    }

    traits = {
        empowered: empowered(2),
        enlarge:   bump('Enlarge', 'radius', 1, 0),
        quickened: quickened(1),
    }

    activate(hero) {
        return aura(this, hero, { affects: 'enemy', turns: this.fieldTurns, castType: 'arcane' })
    }
}
