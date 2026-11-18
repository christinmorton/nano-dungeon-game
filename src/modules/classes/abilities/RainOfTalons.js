import Ability from './Ability.js'
import { rangedRain, lingeringRain } from '../../abilities/ranged.js'
import { playAreaOutline } from '../../Animations.js'

// Ranger ULTIMATE — Rain of Talons. The skirmisher's apex skillshot: a sustained
// storm of arrows over a WIDE area that keeps raining for several rounds.
// Weapon-delegated (needs a bow), so each arrow is a full bow hit through the
// Combat pipeline. tier:'ultimate'.
//
// The cheapest of the three to bring back: rangedRain and lingeringRain were both
// already ported into abilities/ranged.js, so only the progression ladder
// (levelBoosts / augments / traits) came off. Scope doc §10.5.

export default class RainOfTalons extends Ability {
    name = 'Rain of Talons'
    icon = 11
    description = 'A wide arrow storm that keeps raining for three more rounds. 1 AP, cd 12. Needs a bow.'
    cost = { ap: 1, mp: 0 }
    cooldown = 12
    range = 7
    target = 'aoeTile'
    tier = 'ultimate'

    // shape drives the falling arrows; radius drives the aoeTile click preview.
    // They are separate fields and must be kept in step — v3 had a `grow()`
    // helper purely because its ladder could change one and forget the other.
    shape = { kind: 'circle', radius: 3 }
    radius = 3

    damageType = 'physical'
    damageMult = 1.0
    bonusDamage = 0
    knockbackTiles = 0
    fxColor = 0xffcc66

    // Rains for this many EXTRA rounds after the volley thrown on cast.
    lingerRounds = 3

    activate(hero, target) {
        const tile = target.tile
        const border = playAreaOutline(tile.x, tile.y, this.shape, {
            color: this.fxColor, pulse: true, fade: 0,
        })
        const hits = rangedRain(this, hero, tile)
        if (this.lingerRounds > 0) lingeringRain(this, hero, tile, this.lingerRounds, border)
        return hits
    }
}
