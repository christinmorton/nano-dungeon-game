import Ability from './Ability.js'
import { areaStrike } from '../../abilities/patterns.js'
import burning from '../../tags/burning.js'
import { applyCorruption } from '../../tags/corruption.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// DEMONIC tree (§6.8, apex void) — Infernal Blast. A detonation of hellfire over an
// area: heavy fire damage + Burning, and a stack of Corruption (the void DoT) so it
// scorches body and soul. The demon's signature AoE — burst + double attrition.
// Higher-tier (gated). Delivery = areaStrike (circle) + a corruption rider.
// Library/unslotted.

const INFERNAL_TINT = 0xaa2222

export default class InfernalBlast extends Ability {
    name = 'Infernal Blast'
    icon = 31
    description = 'Detonate hellfire on an area (range 6): magicPower + 14..22 fire damage, Burning, and a stack of Corruption. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 6
    target = 'aoeTile'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = INFERNAL_TINT
    requires = { Magic: 30 }

    damageMin = 14
    damageMax = 22
    damageStat = 'magicPower'
    damageType = 'fire'
    appliesStatus = burning

    corruptionPerStack = 5
    corruptionTurns = 4
    corruptionStacks = 1

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = { 2: a => { a.radius += 1; a.shape.radius += 1 } }

    augments = {
        infernal:  { label: 'Greater Inferno', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        brimstone: { label: 'Brimstone', apply: a => { a.damageMin += 8; a.damageMax += 10 } },
        withering: { label: 'Withering', apply: a => { a.corruptionStacks += 1 } },
    }

    traits = {
        empowered: empowered(6),
        enlarge:   { label: 'Enlarge', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        quickened: quickened(1),
    }

    activate(hero, target) {
        const results = areaStrike(this, hero, target.tile, { splash: true })
        for (const { entity, result } of results) {
            if (result.killed) continue
            for (let s = 0; s < this.corruptionStacks; s++) {
                applyCorruption(entity, this.corruptionPerStack, this.corruptionTurns)
            }
        }
        return results
    }
}
