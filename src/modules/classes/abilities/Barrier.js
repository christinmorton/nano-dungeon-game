import Ability from './Ability.js'
import barrier from '../../tags/barrier.js'
import shield from '../../tags/shield.js'
import gameLog from '../../GameLog.js'
import { playCast } from '../../Animations.js'
import { empowerFor } from '../../abilities/empower.js'

// Arcane defense — self-buff. Raise a Barrier for a few turns: +magicPower to BOTH
// the 'armor' and 'barrier' derived stats, mitigating incoming physical AND magic
// damage (a flat per-hit resistance — distinct from Shield, the depletable absorb
// pool). VISUAL: a translucent shield BUBBLE around the caster, grey-white at base;
// a weapon that empowers the ward attunes it to that weapon's colour.
//
// EMPOWERED BY THE WEAPON (scope doc §10.16, user's ask 2026-10-04). Barrier
// declares element 'ward', and a caster weapon's `empower.ward` may add flat
// resist (`wardBonus`), turns (`wardTurns`) or an absorb pool (`wardShield`, the
// Shield status) on top. A staff's +spell power already feeds the barrier, since
// the tag captures the caster's magicPower at apply time; the ward entry is for
// a weapon that makes the Wizard a *better defender*, not just a stronger one.

const BARRIER_GREY = 0xcfd4da

export default class Barrier extends Ability {
    name = 'Barrier'
    icon = 13
    description = 'Self-buff: a shield bubble reducing physical & magic damage (by spell power) for a few turns. 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 0
    target = 'self'
    element = 'ward'

    fxColor = BARRIER_GREY      // grey-white base; an empowering weapon attunes it
    barrierTurns = 4

    activate(hero) {
        const e = empowerFor(this, hero)
        const turns = this.barrierTurns + (e?.wardTurns ?? 0)
        // The tag reads magicPower itself when bonus is null; pass it explicitly
        // only when there is something to add, so the plain cast is unchanged.
        const bonus = e && e.wardBonus ? hero.stat('magicPower') + e.wardBonus : null
        const weapon = hero.currentWeapon?.()
        const color = (e && weapon && weapon.damageColor) ? weapon.damageColor : this.fxColor

        hero.addTag(barrier, turns, bonus, color)
        playCast(hero, { type: 'arcane', tint: color })

        // An absorb pool raised with the barrier. Taggable dedups by name, so a
        // Shield already up gets its pool TOPPED UP rather than the cast silently
        // doing nothing — the same refresh rule applyStun and applyPoison follow.
        if (e && e.wardShield > 0) {
            if (hero._tags?.includes('Shield')) {
                hero._shieldPool = (hero._shieldPool || 0) + e.wardShield
                gameLog.log(`${hero.name}'s shield grows by ${e.wardShield}.`)
            } else {
                hero.addTag(shield, e.wardShield)
            }
        }
        return true
    }
}
