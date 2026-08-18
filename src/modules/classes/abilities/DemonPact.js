import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { attemptPact } from '../../companions/boundSpirit.js'

// Bound Spirit (GREATER band) — the CONTRACT showcase. Attempt a pact with a
// greater demon: it doesn't care about your will, so calling it is a gamble.
//   SUCCESS → it serves you (briefly, devastatingly) as a powerful temporary ally.
//   FAILURE → the pact shatters: the demon turns HOSTILE and hunts you.
// The contract odds rise with the summoner's Magic attunement (contractRoll).
// Heavily gated + long cooldown to match the stakes. Library/unslotted (a future
// Cultist kit; the class/story gate replaces the stat gate later).
//
// Renders the real cosmic demon art (art/cosmic/demons/demon.png). There's also a
// proper Demon ENTITY class now (enemies/Demon.js) — a future refinement is to
// spawn that class on a failed pact instead of a generic descriptor.

export default class DemonPact extends Ability {
    name = 'Demon Pact'
    icon = 31
    description = 'Gamble a pact with a greater demon. WIN: a devastating temporary ally. LOSE: it turns on you and hunts. Odds scale with Magic. 1 AP, cd 12.'
    cost = { ap: 1, mp: 0 }
    cooldown = 12
    range = 4
    target = 'pickTile'
    requires = { Magic: 14, INT: 12 }

    contractChance = 0.55      // base odds before the Magic-attunement nudge

    activate(hero, target) {
        const { x, y } = target.tile
        const { spirit } = attemptPact(hero, {
            tile: { x, y },
            summonKind: 'demon',
            cap: 1,
            lifespan: 12,
            contractChance: this.contractChance,
            name: 'Greater Demon',
            stats: { STR: 16, DEX: 12, CON: 16, SPD: 12, INT: 12, Magic: 16 },
            hp: 80,
            art: { sheet: 'cosmic', file: 'demons/demon.png' },
            weaponName: 'hellish claws',
        })
        if (!spirit) { gameLog.log('There is no room to open the pact there.'); return false }
        playCast(hero, { type: 'fire' })
        return true
    }
}
