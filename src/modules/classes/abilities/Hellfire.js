import Ability from './Ability.js'
import { areaStrike } from '../../abilities/patterns.js'
import burning from '../../tags/burning.js'
import { applyCorruption } from '../../tags/corruption.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// FUSION (Void + Fire) — Hellfire. Black flame that both BURNS and UNMAKES: fire
// damage + Burning to all in the area, plus a stack of Corruption (the Void DoT)
// so the fire eats body and essence together. Fire's burn fused with Void's
// corruption — doubled attrition, the nastiest DoT pairing in the game. ADVANCED /
// higher-tier. Delivery = areaStrike (circle) + a corruption rider. Library/
// unslotted.

const HELLFIRE_TINT = 0x8a1f4a

export default class Hellfire extends Ability {
    name = 'Hellfire'
    icon = 31
    description = 'Wreathe an area in black flame (range 6): magicPower + 8..13 fire damage, Burning, and a stack of Corruption to all caught. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 6
    target = 'aoeTile'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = HELLFIRE_TINT
    requires = { Magic: 15 }

    damageMin = 8
    damageMax = 13
    damageStat = 'magicPower'
    damageType = 'fire'
    appliesStatus = burning

    corruptionPerStack = 4
    corruptionTurns = 4
    corruptionStacks = 1

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 · fire+8..13 + Burning + 1 Corruption
    //   L2 : +1 radius                                                     [boost]
    //   L3 : augment — Infernal (+radius) | Brimstone (+damage) | Withering (+corruption)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1; a.shape.radius += 1 },
    }

    augments = {
        infernal:  { label: 'Infernal', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        brimstone: { label: 'Brimstone', apply: a => { a.damageMin += 5; a.damageMax += 7 } },
        withering: { label: 'Withering', apply: a => { a.corruptionStacks += 1 } },
    }

    traits = {
        empowered: empowered(4),
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
