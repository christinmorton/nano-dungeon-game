import Ability from './Ability.js'
import { areaStrike } from '../../abilities/patterns.js'
import { applyAcid } from '../../tags/acid.js'
import { empowered, quickened } from '../../abilities/traitDefs.js'

// FUSION (Storm + Decay) — Acid Rain. A corrosive downpour called over an area:
// magicPower-scaled magic damage to every enemy caught, then STACKS of Acid (the
// Decay stacking DoT) so the whole pack keeps melting after the burst. The §6
// worked example — Storm's sky bombardment fused with Decay's acid. ADVANCED /
// higher-tier (gated, bigger numbers, longer cd). Delivery = patterns.areaStrike
// (circle). Library/unslotted (the advanced phase).

const ACID_TINT = 0xaaff00

export default class AcidRain extends Ability {
    name = 'Acid Rain'
    icon = 31
    description = 'Call a corrosive downpour on an area (range 6): magicPower + 8..14 damage and 2 stacks of Acid to all caught. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 6
    target = 'aoeTile'
    radius = 2
    shape = { kind: 'circle', radius: 2 }
    fxColor = ACID_TINT
    requires = { Magic: 14 }

    damageMin = 8
    damageMax = 14
    damageStat = 'magicPower'
    damageType = 'magic'

    acidPerStack = 5
    acidTurns = 3
    acidStacks = 2

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 · magic+8..14 · 2 acid stacks
    //   L2 : +1 radius                                                     [boost]
    //   L3 : augment — Downpour (+radius) | Caustic (+damage) | Virulent (+stacks)
    //   L4 : a trait slot — Empowered | Enlarge (+radius) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1; a.shape.radius += 1 },
    }

    augments = {
        downpour: { label: 'Downpour', apply: a => { a.radius += 1; a.shape.radius += 1 } },
        caustic:  { label: 'Caustic',  apply: a => { a.damageMin += 5; a.damageMax += 7 } },
        virulent: { label: 'Virulent', apply: a => { a.acidStacks += 1 } },
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
            for (let s = 0; s < this.acidStacks; s++) applyAcid(entity, this.acidPerStack, this.acidTurns)
        }
        return results
    }
}
