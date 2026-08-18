import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { bolt } from '../../abilities/patterns.js'
import doom from '../../tags/doom.js'
import { empowered, reaching, quickened } from '../../abilities/traitDefs.js'

// Void tree — a dark curse-bolt: light magic damage plus Doom, a lethal countdown
// that drops the target after a few turns regardless of HP. The Void caster's
// finisher / threat — long cooldown to match the payoff. Converted onto
// patterns.bolt; the purple projectile is preserved. PLANNED RENAME → "Knell"
// (de-WoW §1.6); kept until the user confirms. Library/unslotted (Void).

const DOOM_TINT = 0x8822cc
const DOOM_PROJECTILE_TILE = 567

export default class DoomBolt extends Ability {
    name = 'Doom Bolt'
    icon = 31
    description = 'Curse an enemy (range 5): light magic damage and Doom (death in 3 turns). 1 AP, cd 8.'
    cost = { ap: 1, mp: 0 }
    cooldown = 8
    range = 5
    target = 'pickEnemy'
    fxColor = DOOM_TINT

    damageMin = 1
    damageMax = 3
    damageStat = 'magicPower'
    damageType = 'magic'

    doomTurns = 3              // turns until the countdown kills

    // --- Progression ladder ----------------------------------------------------
    //   L1 : light dmg + Doom (3 turns)
    //   L2 : +2 impact damage                                              [boost]
    //   L3 : augment — Greater (+dmg) | Hasten Doom (-1 turn) | Far Doom (+range)
    //   L4 : a trait slot — Empowered | Reaching | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 2; a.damageMax += 2 },
    }

    augments = {
        greater:    { label: 'Greater',     apply: a => { a.damageMin += 4; a.damageMax += 6 } },
        hastenDoom: { label: 'Hasten Doom', apply: a => { a.doomTurns = Math.max(1, a.doomTurns - 1) } },
        farDoom:    { label: 'Far Doom',    apply: a => { a.range += 3 } },
    }

    traits = {
        empowered: empowered(3),
        reaching:  reaching(2),
        quickened: quickened(2),
    }

    activate(hero, target) {
        bolt(this, hero, target.entity, {
            castType: 'arcane',
            projectile: { attackTile: DOOM_PROJECTILE_TILE, tint: DOOM_TINT },
            onImpact: (v, result) => {
                if (!result.killed) {
                    v.addTag(doom, this.doomTurns)
                    gameLog.log(`${hero.name} dooms ${v.name} (${this.doomTurns} turns).`)
                }
            },
        })
    }
}
