import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import evasion from '../../tags/evasion.js'
import { bump, quickened } from '../../abilities/traitDefs.js'

// Evasion — the AVOIDANCE defense: spike your `dodge` for a few turns (the
// Evasion tag) so attacks miss outright rather than being soaked. The skirmisher
// counterpart to the bruiser's mitigation stances (Shield Wall / Brace / Bulwark):
// where they reduce a hit, Evasion skips it. Engine-ready — Combat already rolls
// dodge first for every attack; this just dials the stat up. Anchors the
// stat-spike defensive family (Parry = block spike, etc.). Self-buff. Unslotted —
// the natural Elf signature defense.
export default class Evasion extends Ability {
    name = 'Evasion'
    icon = 31
    description = 'Heighten your reflexes: greatly raise dodge chance for a few turns — attacks miss instead of land. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 0
    target = 'self'

    fxColor = 0xb9f2ff          // pale agility blue — quick-blur pulse

    dodgeAmount = 8             // +dodge points (~+24% chance; near the 50% cap for an agile hero)
    dodgeTurns = 3

    // --- Progression ladder (matches the martial-defense family) ----------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.dodgeAmount += 2 },
    }

    augments = {
        nimble:  bump('Nimble', 'dodgeAmount', 3),
        lasting: { label: 'Lasting', apply: a => { a.dodgeTurns += 2 } },
    }

    traits = {
        untouchable: bump('Untouchable', 'dodgeAmount', 3),
        fleet:       quickened(2),
    }

    activate(hero, target) {
        hero.addTag(evasion, this.dodgeTurns, this.dodgeAmount)
        playCast(hero, { type: 'arcane', tint: this.fxColor })
        gameLog.log(`${hero.name} weaves into an evasive stance.`)
    }
}
