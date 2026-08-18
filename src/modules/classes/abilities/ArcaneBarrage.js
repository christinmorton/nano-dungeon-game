import Ability from './Ability.js'
import { volley } from '../../abilities/patterns.js'
import { empowered, quickened, reaching } from '../../abilities/traitDefs.js'

// Arcane damage — a salvo of homing arcane darts: one at each of the nearest few
// enemies at once (no aim — the volley auto-picks the closest threats). The
// multi-target sibling of Mana Missile; the caster's crowd-spreading filler.
// Delivery = patterns.volley ('enemies' mode); declarative fields drive each
// dart's damage via dealHit. Library/unslotted. Display name "Mana Darts" (the
// many-dart half of the Mana family — its higher versions ARE this ladder, which
// grows the salvo, rather than a separate higher-tier ability).

const ARCANE_TINT = 0xc084fc
const ARCANE_PROJECTILE_TILE = 567

export default class ArcaneBarrage extends Ability {
    name = 'Mana Darts'
    icon = 31
    description = 'Loose a salvo of arcane darts at the nearest enemies (range 5): magicPower + 1..3 each. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 5
    target = 'self'              // auto-targets the nearest enemies — no manual pick

    projectiles = 3              // dart count; the ladder grows the salvo
    damageMin = 1
    damageMax = 3
    damageStat = 'magicPower'
    damageType = 'magic'
    fxColor = ARCANE_TINT

    // --- Progression ladder (leveling IS the "bigger barrage") -----------------
    //   L1 : 3 darts, magicPower + 1..3 each
    //   L2 : 4 darts                                                       [boost]
    //   L3 : augment — Overcharge (+2 darts) | Seeking (+range) | Piercing (+dmg/dart)
    //   L4 : a trait slot — Empowered | Quickened | Reaching
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.projectiles += 1 },        // 3 -> 4 darts
    }

    augments = {
        overcharge: { label: 'Overcharge', apply: a => { a.projectiles += 2 } },         // a bigger salvo
        seeking:    { label: 'Seeking', apply: a => { a.range += 3 } },                  // finds farther targets
        piercing:   { label: 'Piercing Darts', apply: a => { a.damageMin += 2; a.damageMax += 3 } },
    }

    traits = {
        empowered: empowered(1),
        quickened: quickened(1),
        reaching:  reaching(2),
    }

    activate(hero) {
        return volley(this, hero, {
            mode: 'enemies',
            count: this.projectiles,
            projectile: { attackTile: ARCANE_PROJECTILE_TILE, tint: ARCANE_TINT },
        })
    }
}
