import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import parry from '../../tags/parry.js'
import { bump, quickened } from '../../abilities/traitDefs.js'

// Parry — the NEGATION defense: spike your `block` for a few turns (the Parry tag)
// so physical blows are turned aside. Sibling of Evasion in the stat-spike family,
// on the block primitive instead of dodge. Physical-only by nature (Combat's block
// roll only fires on physical damage), so it's the melee/weapon counter — pairs
// with Spell Ward (magic) for a full cover. Self-buff. Unslotted — a Warrior/Dwarf
// fit, but class-agnostic. See the passive cousin, Deflection (permanent +block).
export default class Parry extends Ability {
    name = 'Parry'
    icon = 31
    description = 'Raise a parrying guard: greatly raise block chance vs physical attacks for a few turns. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 0
    target = 'self'

    fxColor = 0xd8d8e0          // steel sheen — quick parry flash

    blockAmount = 8            // +block points (~+24% block chance; physical only)
    blockTurns = 3

    // --- Progression ladder (matches the martial-defense family) ----------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.blockAmount += 2 },
    }

    augments = {
        deflecting: bump('Deflecting', 'blockAmount', 3),
        lasting:    { label: 'Lasting', apply: a => { a.blockTurns += 2 } },
    }

    traits = {
        impenetrable: bump('Impenetrable', 'blockAmount', 3),
        quickened:    quickened(2),
    }

    activate(hero, target) {
        hero.addTag(parry, this.blockTurns, this.blockAmount)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name} sets a parrying stance.`)
    }
}
