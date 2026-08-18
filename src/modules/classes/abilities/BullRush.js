import Ability from './Ability.js'
import dungeon from '../../Dungeon.js'
import gameLog from '../../GameLog.js'
import { glide, knockback, shockwave } from '../../abilities/universals.js'
import { slam } from '../../abilities/patterns.js'
import { applyDaze } from '../../tags/daze.js'
import sunder from '../../tags/sunder.js'
import { playChargeArrow, playLunge, playTrail } from '../../Animations.js'
import { startCharge, chargeTick, overcharge } from '../../abilities/chargedCast.js'
import { quickened, addStatus, bump } from '../../abilities/traitDefs.js'

// Bull Rush — a TANK / BRUTE charged gap-closer, and the SECOND user of the
// windup → fire → ending lifecycle (chargedCast.js): proof the pattern drives a
// melee dash, not just a beam. On cast the brute plants and winds up — a
// directional arrow telegraphs the lane (aim with the mouse or arrow keys) — then
// HURLS forward up to N tiles: it hits the first enemy with an UNBLOCKABLE weapon
// strike, then SLAMS it back (patterns.slam) — if it crashes into a wall, object,
// or another enemy it's stunned (loses the rest of this turn AND its next turn) and
// whatever it hit is dazed; shoved into open space it just slides. The landing
// impact then DAZES the surrounding cluster (a shockwave). Tap the key again
// mid-windup to OVERCHARGE — a longer, harder rush. Hard CC during the wind-up
// interrupts it (the rush is lost).
//
// Damage is WEAPON-delegated but UNBLOCKABLE (the hit skips dodge/block; armor +
// crit still apply); chargedCast just wraps it in the commit→telegraph→recover
// cadence. Tank/brute role: an initiator / peel tool —
// close the gap, scatter a cluster, lock the primary target down. Meant for a
// brute or tank profile (gated on STR + CON), not the "soldier" Warrior; unslotted
// for now (the bench auto-discovers it).

const RUSH_TINT = 0xd98a3a    // earthy brute orange

export default class BullRush extends Ability {
    name = 'Bull Rush'
    icon = 31
    description = 'Wind up, then charge up to 5 tiles: an UNBLOCKABLE slam on the first enemy — if it hits a wall or another enemy it loses this turn AND is stunned next turn; the landing dazes nearby enemies. Tap again mid-charge to overcharge. Needs STR + CON. cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'direction'

    // Rides the Invocation channel driver: locked & stationary through the
    // wind-up, self-terminates after the ending. Aim-locked (a direction), so it
    // only breaks on a hard-CC interrupt, never on line-of-sight.
    channeled = true
    invokeVerb = 'winding up a Bull Rush'
    breaksOnLineOfSight = false

    // Brute body — a STR + CON gate (the bench flips TRAINING_GATES_OFF so any
    // hero can exercise it). First-draft thresholds; tune on the bench.
    requires = { STR: 14, CON: 12 }

    // --- charged-cast lifecycle knobs (ms). A touch snappier wind-up than the
    // beam — it's a physical lunge, not a spell channel.
    windupMs = 650
    fireMs = 160
    endingMs = 480
    overchargeWindupMs = 350
    maxOvercharge = 2

    fxColor = RUSH_TINT

    // --- charge mechanics (riders on a weapon hit, NOT self-computed damage, so
    // the declarative damage* fields stay 0). Overcharge scales reach + shove.
    maxSteps = 5             // how far the rush travels
    knockbackTiles = 3       // shove on the slammed target
    impactRadius = 1.5       // landing shockwave reach (the 8 adjacent tiles)
    overchargeSteps = 1      // +reach per overcharge stack
    overchargeKnockback = 1  // +shove per overcharge stack

    // Extra rider status applied to the PRIMARY slam victim (null at base; a trait
    // like Bonecrusher fills it). The slam itself already stuns on a wall-collision
    // — this is an ADDED debuff layered on whoever the brute charges into.
    appliesStatus = null

    // --- Progression ladder (account-level growth, SEPARATE from the per-cast
    // overcharge re-press) ------------------------------------------------------
    //   L1 base : reach 5 · knockback 3 · impactRadius 1.5 · cd 6
    //   L2      : reach 6                                              [boost]
    //   L3      : pick an augment (juggernaut / seismic / stampede)
    //   L4      : a trait slot opens (quickened / quaking / bonecrusher)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.maxSteps += 1 },   // reach 5 -> 6
    }

    augments = {
        juggernaut: { label: 'Juggernaut', apply: a => { a.maxSteps += 2; a.knockbackTiles += 1 } },
        seismic:    { label: 'Seismic',    apply: a => { a.impactRadius += 1 } },
        stampede:   { label: 'Stampede',   apply: a => { a.maxOvercharge += 1; a.overchargeSteps += 1 } },
    }

    traits = {
        quickened:   quickened(1),
        quaking:     bump('Quaking', 'impactRadius', 0.5),
        bonecrusher: addStatus('Bonecrusher', sunder),
    }

    // --- channel hooks (called by HeroController) ---
    onChannelStart(aim) { startCharge(this, aim) }
    overchargeOnRepress() { return overcharge(this) }

    tick(hero, aim) {
        return chargeTick(this, hero, {
            telegraph: (vec) => playChargeArrow(hero, vec.dx, vec.dy, { color: this.fxColor }),
            fire: (vec, cast) => this._charge(hero, vec, cast),
        })
    }

    // The rush itself: glide forward, slam the enemy charged into, then a landing
    // shockwave that scatters the cluster. Mirrors the instant Charge body, scaled
    // by overcharge.
    _charge(hero, aim, cast) {
        const weapon = hero.currentWeapon()
        const steps = this.maxSteps + this.overchargeSteps * cast.overcharge
        const kb = this.knockbackTiles + this.overchargeKnockback * cast.overcharge

        const result = glide(hero, aim.dx, aim.dy, steps)
        const target = result.blockedByEntity?.type === 'enemy' ? result.blockedByEntity : null
        if (result.steps === 0 && !target) {
            gameLog.log(`${hero.name}'s Bull Rush has nowhere to go.`)
            return
        }

        // Primary slam on the enemy charged into — an UNBLOCKABLE weapon hit (you
        // can't parry a charging brute), then SLAM it back: if it crashes into a
        // wall / object / another enemy it's stunned (loses this turn AND the next)
        // and whatever it hit is dazed; shoved into open space it just slides.
        if (target) {
            // Point-blank rush (the brute was already adjacent) — glide moved no
            // body, so thrust forward into the target + streak the dash trail so
            // the slam still reads as a charge.
            if (result.steps === 0) {
                playTrail(hero.x, hero.y, target.x, target.y)
                playLunge(hero, aim.dx, aim.dy)
            }
            if (weapon) {
                dungeon.attackEntity(hero, target, weapon, { unblockable: true })
            } else {
                gameLog.log(`${hero.name} barrels into ${target.name} bare-handed.`)
            }
            if (target.sprite) slam(target, aim.dx, aim.dy, kb)
            // Added rider debuff (e.g. Bonecrusher → sunder) on top of the slam's
            // own collision-stun. Null at base, so this is a no-op until a trait fills it.
            if (this.appliesStatus) for (const status of [].concat(this.appliesStatus)) target.addTag(status)
        }

        // Landing impact: everyone next to where the brute stops is DAZED (loses
        // their turn) and shoved — the tank "scatter the cluster" payoff. The
        // primary target already took the full slam, so skip it here.
        const impactDamage = Math.floor(hero.stat('attackPower') / 2)
        shockwave(hero, {
            radius: this.impactRadius,
            damage: impactDamage,
            type: 'physical',
            fxColor: this.fxColor,
            onHit: (victim, dx, dy) => {
                if (victim === target) return
                knockback(victim, Math.sign(dx), Math.sign(dy), 1)
                applyDaze(victim)
            },
        })
    }
}
