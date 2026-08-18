import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { summon } from '../../companions/summon.js'

// Shaman — raise a Bedrock Sentinel at a picked tile: a slow, tanky earthen
// guardian to soak hits and bodyblock for the party. Temporary, and only one at
// a time. (Placeholder art: a stone-tinted tile until a sentinel sprite lands.)

export default class BedrockSentinel extends Ability {
    name = 'Bedrock Sentinel'
    icon = 31
    description = 'Summon a tanky bedrock sentinel at a tile (range 4). Fades after ~14 turns; only 1. 1 AP, cd 10.'
    cost = { ap: 1, mp: 0 }
    cooldown = 10
    range = 4
    target = 'pickTile'

    activate(hero, target) {
        const { x, y } = target.tile
        const sentinel = summon(hero, {
            tile: { x, y },
            summonKind: 'bedrockSentinel',
            cap: 1,
            lifespan: 14,
            name: 'Bedrock Sentinel',
            stats: { STR: 16, DEX: 5, CON: 18, SPD: 6, INT: 3, Magic: 3 },
            hp: 90,
            tint: 0xb0a080,
            weaponName: 'stone fists',
        })
        if (!sentinel) { gameLog.log('No room to summon a bedrock sentinel there.'); return false }
        playCast(hero, { type: 'earth' })
        gameLog.log(`${hero.name} raises a bedrock sentinel.`)
    }
}
