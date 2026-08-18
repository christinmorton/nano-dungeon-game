import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { shockwave } from '../../abilities/universals.js'
import blind from '../../tags/blind.js'
import { enlarge, quickened, efficient } from '../../abilities/traitDefs.js'

// Holy tree — a burst of divine light blinds every enemy within radius (Blind:
// their next few attacks are likely to MISS, and they dodge a little less). The
// Cleric's defensive panic button vs a melee swarm. Composes the shockwave verb
// with minimal chip damage. Always casts. Library/unslotted (reassigned from the
// old control pool to Holy per encyclopedia §4).

export default class BlindingFlash extends Ability {
    name = 'Blinding Flash'
    icon = 31
    description = 'Blind every enemy within 2 tiles — their next few attacks are likely to miss. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 2
    target = 'self'
    fxColor = 0xfff2b0

    radius = 2
    chip = 1
    blindCharges = 3           // how many of each foe's next attacks may whiff

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r2 flash · Blind (3 charges)
    //   L2 : +1 radius                                                     [boost]
    //   L3 : augment — Wide (+radius) | Searing (+chip dmg) | Overwhelming (+charges)
    //   L4 : a trait slot — Enlarge (+radius) | Quickened | Efficient
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.radius += 1 },
    }

    augments = {
        wide:         { label: 'Wide',         apply: a => { a.radius += 1 } },
        searing:      { label: 'Searing',      apply: a => { a.chip += 6 } },
        overwhelming: { label: 'Overwhelming', apply: a => { a.blindCharges += 2 } },
    }

    traits = {
        enlarge:   enlarge(1),
        quickened: quickened(1),
        efficient: efficient({ ap: 0, mp: 0 }),
    }

    activate(hero, target) {
        playCast(hero, { type: 'heal' })
        const hits = shockwave(hero, {
            radius: this.radius,
            damage: this.chip,
            type: 'magic',
            fxColor: this.fxColor,
            onHit: (v) => v.addTag(blind, this.blindCharges),
        })
        gameLog.log(hits.length
            ? `${hero.name}'s flash blinds ${hits.length} ${hits.length === 1 ? 'enemy' : 'enemies'}.`
            : `${hero.name} flares with blinding light.`)
        return true
    }
}
