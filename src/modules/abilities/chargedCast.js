// chargedCast.js — the windup → fire → ending lifecycle for CHARGED casts. A
// Layer-2 META-PATTERN: unlike the delivery patterns in patterns.js (which land
// their payload THIS instant), a charged cast is a CHANNELED ability whose tick()
// advances a phase machine over TIME. It reuses the Invocation channel backbone
// in HeroController (the caster is locked and stationary, and is interrupted by
// hard CC) but AUTO-TERMINATES when the sequence finishes.
//
// PHASES — paced by WALL-CLOCK, not by turn count. (The turn loop only throttles
// engaged combat to 150ms/round; an idle hero's channel ticks every frame, so a
// turn-count windup would elapse in ~3 frames and be invisible — e.g. on the
// training bench. Pacing each phase by ms makes the wind-up visible everywhere,
// the same way the engine already paces combat with Date.now(). The caster stays
// locked the whole time, so engaged enemies still get their turns during it.)
//   WINDUP  (windupMs) — the caster gathers power, locked in place; a telegraph
//            pulses along where the payload WILL land. No damage yet. Pressing the
//            ability key again OVERCHARGES (more power/width + extends the windup),
//            up to maxOvercharge — the "charge for more" choice.
//   FIRE    (fireMs) — run fire(aim, cast) ONCE, start the cooldown, then hold on
//            the flash a beat.
//   ENDING  (endingMs) — a short recovery; the cast is spent but the caster is
//            still locked (exposed) before regaining control.
// Hard CC during the wind-up interrupts and the shot is LOST (cast.fired stays
// false). The occupied time IS the cost.
//
// The ability owns the WHAT (fire / telegraph callbacks + the *Ms / overcharge
// knobs as fields); this module owns the WHEN. State lives on ability._cast.

import gameLog from '../GameLog.js'

// Per-phase real-time defaults (ms). An ability overrides via windupMs / fireMs /
// endingMs; overcharge stretches the windup by overchargeWindupMs per stack.
const DEFAULT_WINDUP_MS = 800
const DEFAULT_FIRE_MS = 200
const DEFAULT_ENDING_MS = 450
const DEFAULT_OVERCHARGE_WINDUP_MS = 450
const TELEGRAPH_INTERVAL_MS = 160   // repaint cadence for the windup telegraph

// Begin a fresh cast — called from the ability's onChannelStart(aim) hook the
// moment the channel locks on. `aim` is the resolved { dx, dy } direction.
export function startCharge(ability, aim) {
    ability._cast = {
        phase: 'windup',
        overcharge: 0,
        aim: { dx: aim?.dx ?? 0, dy: aim?.dy ?? 0 },
        phaseStartedAt: Date.now(),
        lastTelegraphAt: 0,
        fired: false,
    }
    return ability._cast
}

// How long the current phase should last (ms), including overcharge stretch.
function phaseDuration(ability, cast) {
    if (cast.phase === 'windup') {
        const base = ability.windupMs ?? DEFAULT_WINDUP_MS
        const per = ability.overchargeWindupMs ?? DEFAULT_OVERCHARGE_WINDUP_MS
        return base + per * cast.overcharge
    }
    if (cast.phase === 'fire') return ability.fireMs ?? DEFAULT_FIRE_MS
    if (cast.phase === 'ending') return ability.endingMs ?? DEFAULT_ENDING_MS
    return 0
}

// Add an overcharge stack — only while still winding up and under the cap. Each
// stack lengthens the windup (via phaseDuration) and, through cast.overcharge,
// raises the payload. Returns true if the press was consumed as an overcharge.
export function overcharge(ability) {
    const cast = ability._cast
    if (!cast || cast.phase !== 'windup') return false
    if (cast.overcharge >= (ability.maxOvercharge ?? 0)) return false
    cast.overcharge += 1
    gameLog.log(`${ability.hero?.name ?? 'The caster'} pours more power into ${ability.name} (overcharge ${cast.overcharge}).`)
    return true
}

// Advance the cast. Called every channel tick; advances a phase only once its
// wall-clock duration has elapsed. The ability supplies fire(aim, cast) (the
// payload) and telegraph(aim, cast) (the windup hint, repainted on a throttle).
// Returns true once the whole sequence is finished so the channel releases.
export function chargeTick(ability, hero, { fire, telegraph, liveAim } = {}) {
    const cast = ability._cast
    if (!cast) return true
    const now = Date.now()
    const elapsed = now - cast.phaseStartedAt

    if (cast.phase === 'windup') {
        if (telegraph && now - cast.lastTelegraphAt >= TELEGRAPH_INTERVAL_MS) {
            telegraph(cast.aim, cast)
            cast.lastTelegraphAt = now
        }
        if (elapsed < phaseDuration(ability, cast)) return false
        cast.phase = 'fire'
        cast.phaseStartedAt = now
        return false
    }

    if (cast.phase === 'fire') {
        if (!cast.fired) {
            fire?.(cast.aim, cast)
            ability.cooldownRemaining = ability.cooldown ?? 0   // spent — start the cooldown now
            cast.fired = true
            gameLog.log(`${hero.name} looses ${ability.name}!`)
        }
        if (elapsed < phaseDuration(ability, cast)) return false
        // SUSTAIN — an optional "keep the beam firing" phase (Mana Beam's Sustained
        // augment): re-fire on an interval, steering toward the live aim, for
        // sustainMs before the ending. sustainMs 0 (base) = a single shot.
        if ((ability.sustainMs ?? 0) > 0) {
            cast.phase = 'sustain'
            cast.phaseStartedAt = now
            cast.sustainStartedAt = now
            cast.lastSustainFireAt = now
            return false
        }
        cast.phase = (ability.endingMs ?? DEFAULT_ENDING_MS) > 0 ? 'ending' : 'done'
        cast.phaseStartedAt = now
        return cast.phase === 'done'
    }

    if (cast.phase === 'sustain') {
        // Steer: a steerable channel re-aims toward the live aim each tick (the
        // player turning the beam with arrow keys). Locked channels stay fixed.
        if (ability.steerable && liveAim && (liveAim.dx || liveAim.dy)) {
            cast.aim = { dx: liveAim.dx, dy: liveAim.dy }
        }
        const interval = ability.sustainIntervalMs ?? ability.fireMs ?? DEFAULT_FIRE_MS
        if (now - cast.lastSustainFireAt >= interval) {
            fire?.(cast.aim, cast)
            cast.lastSustainFireAt = now
        }
        if (now - cast.sustainStartedAt < ability.sustainMs) return false
        cast.phase = (ability.endingMs ?? DEFAULT_ENDING_MS) > 0 ? 'ending' : 'done'
        cast.phaseStartedAt = now
        return cast.phase === 'done'
    }

    if (cast.phase === 'ending') {
        if (elapsed < phaseDuration(ability, cast)) return false
        cast.phase = 'done'
        return true
    }

    return true
}

// Did this cast already loose its payload? Lets a caller tell a wasted interrupt
// (CC during windup — shot lost) from a harmless one (CC during the ending).
export function chargeHasFired(ability) {
    return !!ability._cast?.fired
}
