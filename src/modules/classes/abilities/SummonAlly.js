import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import Follower from '../../companions/Follower.js'

// DEBUG ability — Slice 1 test driver for the follower system (2026-06-10).
// Pick a walkable tile in range; spawn a Follower (ally) there that trails the
// caster and fights the caster's enemies. Provisionally on the Wizard's E slot
// (swapped in for Gale Wall, the provisional test slot).
//
// This is the SURFACE layer (an Ability). It constructs the Follower directly
// for now; later it's replaced by real summon spells composing the `summon`
// universal verb (Slice 3). pickTile validates "walkable + in range" in
// HeroController.resolveTargetedClick, so activate() can trust target.tile.

export default class SummonAlly extends Ability {
    name = 'Summon Ally'
    icon = 0
    description = 'DEBUG: summon a spectral ally on a picked tile (range 5). It follows you and fights your enemies. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'pickTile'

    activate(hero, target) {
        const { x, y } = target.tile
        new Follower(x, y, { leader: hero, owner: hero })
        playCast(hero, { type: 'arcane' })
        gameLog.log(`${hero.name} summons a spectral ally.`)
    }
}
