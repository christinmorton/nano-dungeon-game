import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { summonSpirit } from '../../companions/boundSpirit.js'

// Bound Spirit (LESSER band) — bind an Imp, a lesser fiend, to fight at your side
// for a time. A GATED willed summon: it needs real magical training (the `requires`
// gate; the training bench flips gates off). Temporary (lifespan) + capped to one.
// Reuses the existing Imp entity art. The simplest bound-spirit case — no contract
// roll; the gate IS the cost. Library/unslotted (a future Cultist/void kit).

export default class SummonImp extends Ability {
    name = 'Summon Imp'
    icon = 31
    description = 'Bind a lesser fiend (an Imp) to fight for you for ~12 turns. Needs magical training. 1 AP, cd 8.'
    cost = { ap: 1, mp: 0 }
    cooldown = 8
    range = 4
    target = 'pickTile'
    requires = { Magic: 12 }   // gated — a willed summon needs the attunement

    activate(hero, target) {
        const { x, y } = target.tile
        const imp = summonSpirit(hero, {
            tile: { x, y },
            summonKind: 'imp',
            cap: 1,
            lifespan: 12,
            name: 'Bound Imp',
            stats: { STR: 9, DEX: 12, CON: 8, SPD: 12, INT: 10, Magic: 12 },
            hp: 26,
            art: { sheet: 'monsters', file: 'imp_south.png' },
            tint: 0xcc4422,
            weaponName: 'claws',
        })
        if (!imp) { gameLog.log('No room to bind an imp there.'); return false }
        playCast(hero, { type: 'arcane' })
        gameLog.log(`${hero.name} binds an imp to their service.`)
        return true
    }
}
