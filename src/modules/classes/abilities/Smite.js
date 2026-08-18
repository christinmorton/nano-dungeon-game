import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { bolt } from '../../abilities/patterns.js'
import { resolveDamage } from '../../abilities/universals.js'
import { isUndead } from '../../enemies/enemyKinds.js'
import { empowered, reaching, quickened } from '../../abilities/traitDefs.js'

// Holy tree — a bolt of divine light at one enemy: magicPower-scaled holy damage,
// DOUBLED vs undead (the Giantslayer-style rider — a second equal holy strike on
// undead). The Cleric's bread-and-butter ranged attack; the anti-undead damage of
// the survival kit. Converted onto patterns.bolt; the gold projectile is preserved.
// PLANNED RENAME → "Edict" (de-WoW §1.6); kept as Smite until the user confirms.
// Slotted (Cleric).

const HOLY_TINT = 0xFFD700
const HOLY_PROJECTILE_TILE = 567

export default class Smite extends Ability {
    name = 'Smite'
    icon = 31
    description = 'Holy bolt at a picked enemy (range 4): magicPower + 4..8 damage, DOUBLED vs undead. 1 AP, cd 3.'
    cost = { ap: 1, mp: 0 }
    cooldown = 3
    range = 4
    target = 'pickEnemy'
    fxColor = HOLY_TINT

    damageMin = 4
    damageMax = 8
    damageStat = 'magicPower'
    damageType = 'magic'

    // --- Progression ladder ----------------------------------------------------
    //   L1 : magic+4..8 · ×2 vs undead
    //   L2 : +2 damage                                                     [boost]
    //   L3 : augment — Radiant (+dmg) | Consecrated (×3 vs undead) | Far Light (+range)
    //   L4 : a trait slot — Empowered | Reaching | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    undeadMult = 2             // total damage multiplier vs undead (rider below)

    levelBoosts = {
        2: a => { a.damageMin += 2; a.damageMax += 2 },
    }

    augments = {
        radiant:     { label: 'Radiant',     apply: a => { a.damageMin += 4; a.damageMax += 6 } },
        consecrated: { label: 'Consecrated', apply: a => { a.undeadMult = 3 } },
        farLight:    { label: 'Far Light',   apply: a => { a.range += 3 } },
    }

    traits = {
        empowered: empowered(3),
        reaching:  reaching(2),
        quickened: quickened(1),
    }

    activate(hero, target) {
        const victim = target.entity
        bolt(this, hero, victim, {
            castType: 'heal',     // gold/white holy pulse (no dedicated 'holy' preset yet)
            projectile: { attackTile: HOLY_PROJECTILE_TILE, tint: HOLY_TINT },
            onImpact: (v, result) => {
                // Giantslayer rider: undead take (undeadMult-1)× the base hit again
                // as extra holy damage — undeadMult 2 = double, 3 = triple.
                if (result.killed || !isUndead(v)) return
                const extra = this.rollDamage(hero) * (this.undeadMult - 1)
                const bonus = resolveDamage(v, extra, this.damageType, { attacker: hero })
                gameLog.log(`Holy light scours ${v.name} for ${bonus.applied} more (×${this.undeadMult} vs undead!).`)
            },
        })
    }
}
