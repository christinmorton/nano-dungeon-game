import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import evasion from '../../tags/evasion.js'
import { leap } from '../../abilities/patterns.js'
import { quickened, reaching, bump } from '../../abilities/traitDefs.js'

// Elf / skirmisher — the escape. Spring a short distance to a chosen tile, leaping
// OVER intervening enemies and terrain (leap, not a glide that stops at the first
// wall), and land braced to dodge: a brief Evasion spike. The "get out of melee"
// button — break away from a bruiser and reset to bow range. Self-contained,
// library/unslotted. Non-combat-ish mobility but usable mid-fight.

export default class Disengage extends Ability {
    name = 'Disengage'
    icon = 31
    description = 'Leap to a nearby tile (over enemies/terrain) and land evasive for a couple of turns. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 4
    target = 'pickTile'

    fxColor = 0xbfe3ff          // pale agility blue (matches the Evasion family)

    // Brief dodge spike on landing — lighter/shorter than the Evasion stance.
    evasionTurns = 2
    evasionAmount = 6

    // --- Progression ladder ----------------------------------------------------
    //   L1 : leap range 4 + brief Evasion
    //   L2 : +2 Evasion strength                                          [boost]
    //   L3 : augment — Vault (+2 range) | Lingering (+2 Evasion turns) | Nimble (+4 Evasion)
    //   L4 : a trait slot — Quickened | Reaching (range) | Bracing (+Evasion)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.evasionAmount += 2 },
    }

    augments = {
        vault:     { label: 'Vault', apply: a => { a.range += 2 } },
        lingering: { label: 'Lingering', apply: a => { a.evasionTurns += 2 } },
        nimble:    { label: 'Nimble', apply: a => { a.evasionAmount += 4 } },
    }

    traits = {
        quickened: quickened(1),
        reaching:  reaching(1),
        bracing:   bump('Bracing', 'evasionAmount', 3),
    }

    activate(hero, target) {
        const dest = leap(this, hero, target)
        if (!dest) return false
        hero.addTag(evasion, this.evasionTurns, this.evasionAmount)
        gameLog.log(`${hero.name} disengages and lands light on their feet.`)
        return dest
    }
}
