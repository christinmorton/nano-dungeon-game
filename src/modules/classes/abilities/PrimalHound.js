import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { summon } from '../../companions/summon.js'

// Shaman — call a Primal Hound at a picked tile: a fast, fragile spirit-beast
// that fights as part of your party. Temporary (fades) and capped to a small
// pack so it can't snowball. Uses the wolf sprite, spirit-tinted.

export default class PrimalHound extends Ability {
    name = 'Primal Hound'
    icon = 31
    description = 'Summon a fast primal hound at a tile (range 4). Fades after ~14 turns; up to 2. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 4
    target = 'pickTile'

    activate(hero, target) {
        const { x, y } = target.tile
        const hound = summon(hero, {
            tile: { x, y },
            summonKind: 'primalHound',
            cap: 2,
            lifespan: 14,
            name: 'Primal Hound',
            stats: { STR: 9, DEX: 13, CON: 8, SPD: 14, INT: 4, Magic: 4 },
            hp: 22,
            art: { sheet: 'monsters', file: 'wolf_south.png' },
            tint: 0x99ffcc,
            weaponName: 'spirit fangs',
        })
        if (!hound) { gameLog.log('No room to summon a primal hound there.'); return false }
        playCast(hero, { type: 'nature' })
        gameLog.log(`${hero.name} calls a primal hound.`)
    }
}
