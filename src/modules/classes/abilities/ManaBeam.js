import Ability from './Ability.js'
import mapState from '../../MapState.js'
import dungeon from '../../Dungeon.js'
import tm from '../../TurnManager.js'
import { beam } from '../../abilities/universals.js'
import { playHeldBeam, playChannelGather } from '../../Animations.js'
import { startCharge, chargeTick, overcharge } from '../../abilities/chargedCast.js'
import { empowerOnHit } from '../../abilities/empower.js'

// Wizard S — Mana Beam. The only CHARGED ability in v5, and deliberately so:
// four of the Wizard's other five are press-and-resolve, and this one asks the
// player to stand still and commit. Casting begins a wind-up (the caster locks
// in place while motes gather and a faint beam telegraphs where it will land),
// then the beam LIGHTS and is HELD for about two seconds, steered by click and
// burning everything in its line on a 350ms pulse, then recovers. Phases are
// paced by wall clock, so the wind-up is visible however fast turns are cycling.
//
// OVERCHARGE: tap the key again during the wind-up to pour in more power. Each
// stack widens the beam by a lane on each side and adds flat damage to every
// pulse, at the cost of a longer wind-up — and hard CC during that wind-up loses
// the shot entirely. That is the whole risk/reward of the ability.
//
// THIS IS THE SUSTAINED BEAM, AND ONLY THAT (2026-10-04, scope doc §10.16, the
// user's call: "lets use the sustained version"). Between 2026-09-20 and then
// the file carried a VARIANTS table — a single-shot "v3" look beside this one —
// with console switches in World.js so the two could be compared in play. The
// single shot lost; the table, the switches and the trace logging are gone. If
// a single-shot beam is ever wanted again, set sustainMs to 0: chargedCast
// already treats that as "fire once and end".
//
// WHY THE PULSES USED TO MISS, AND THE FIX. A beam burns exactly one of the
// eight lanes out of the caster, and the caster is locked for the whole cast
// while engaged enemies keep taking turns. So they closed to melee and stood on
// one of the seven adjacent tiles that are NOT the lane, and every pulse after
// the first found empty floor. The fix is _autoAim: each frame the aim snaps to
// the nearest enemy standing ON a lane within one compass step (45°) of where
// the player is pointing. The player still picks the direction with a click —
// steering is unchanged — and the beam does the fine aim, tracking what it is
// burning instead of staring at the tile the enemy just left.
//
// WHAT THIS PORT DID NOT BRING. v3's version delivers through `shapeStrike` with
// a `beamLine` shape spec. v5's patterns file is five functions against v3's
// ~thirty and stays that way: this is rebuilt on the `beam` verb already in
// universals.js, which walks a line, stops at the first wall, and pierces every
// enemy with `aoe: true` — that flag being what makes a beam undodgeable, which
// is exactly the promise v3's description made. Width comes from firing parallel
// lanes rather than from a shape. The lifecycle module `abilities/chargedCast.js`
// came over verbatim (it imports only GameLog), and HeroController's invocation
// driver was already here in full.

const ARCANE_TINT = 0xb98bff

// How fast a steered beam swings, in radians per second. At 7 a full 45-degree
// step between adjacent compass directions takes about 110ms — fast enough that
// the beam feels responsive to a click, slow enough to read as a sweep rather
// than a snap. A half-turn (clicking behind yourself) takes about 450ms.
const TURN_RATE = 7

// The look. Wind-up telegraph: thin, dim, coreless, so charging reads as a
// promise rather than a shot. Release: ONE bar across the whole beam (lane count
// is the width, so overcharge thickens one beam rather than adding parallel
// ones), held lit for the whole sustain window and faded exactly once. playBeam
// is a one-shot that fades in ~260ms; a beam made of repeated calls is a strobe
// by construction, which is what read as blinking at every tick rate. See
// Animations.playHeldBeam.
const TELEGRAPH_WIDTH = 0.55
const TELEGRAPH_ALPHA = 0.22
const FIRE_WIDTH = 0.72           // per lane, matching v3's shapeStrike fx.beam
const BEAM_HOLD_MS = 2200         // how long the lit bar stays before its fade

// The eight compass directions in ring order, for "how many steps apart are
// these two aims". Index distance around the ring is the angular distance.
const COMPASS = [
    { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 1 },
    { dx: -1, dy: 0 }, { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
]
function compassIndex(dir) {
    return COMPASS.findIndex(c => c.dx === dir.dx && c.dy === dir.dy)
}
function compassSteps(a, b) {
    const ia = compassIndex(a), ib = compassIndex(b)
    if (ia < 0 || ib < 0) return 8
    const d = Math.abs(ia - ib)
    return Math.min(d, 8 - d)
}

export default class ManaBeam extends Ability {
    name = 'Mana Beam'
    icon = 16
    // Kept under ~132 characters deliberately: this string is also what the
    // class-select card prints, and the card budgets two wrapped lines per
    // ability. See Intro.js's CARD_H note.
    description = 'Charge, then hold a steerable beam that burns its whole line for 2s: no dodge, no block. Tap mid-charge to overcharge. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 6
    target = 'direction'
    fxColor = ARCANE_TINT

    // PER PULSE. The beam fires once on release and then every
    // sustainIntervalMs for sustainMs — about six pulses — so a target that
    // stays in the lane takes six of these. Rescaled 2026-10-04 (scope doc
    // §10.16): was magicPower + 14..20 as a single shot.
    damageScale = 1.5
    damageMin = 8
    damageMax = 12
    damageStat = 'magicPower'
    damageType = 'magic'
    element = 'arcane'        // empowered by a weapon's `all` entry (§10.16)

    // Routed through the invocation driver: the caster is locked and stationary
    // while charging, and the cast self-terminates after its ending. Aim-locked
    // rather than entity-locked, so it never breaks on line of sight — only a
    // hard-CC interrupt stops it.
    channeled = true
    invokeVerb = 'channeling Mana Beam'
    breaksOnLineOfSight = false
    // chargedCast paces its phases by wall clock, so the phase machine must be
    // ticked every frame — not once per round, which is what made the wind-up
    // blink in step with the turn counter. See Ability.framePaced.
    framePaced = true

    // Charged-cast knobs, read by chargedCast.js. Milliseconds.
    windupMs = 800
    fireMs = 220
    endingMs = 450
    overchargeWindupMs = 450
    maxOvercharge = 2
    overchargePower = 10      // flat damage added per stack, to EVERY pulse
    overchargeLanes = 1       // extra lanes per side, per stack

    // Sustain, read by chargedCast.js's sustain phase: re-fire every
    // sustainIntervalMs for sustainMs, steering toward the live aim. These are
    // the fields that make this the sustained beam; sustainMs 0 would make it a
    // single shot again.
    sustainMs = 2000
    sustainIntervalMs = 350
    steerable = true

    // --- channel hooks (called by HeroController) ---

    onChannelStart(aim) {
        // Clear the sweep clock so a new cast measures its first frame from now
        // rather than from whenever the previous cast ended — a stale timestamp
        // would hand step() a delta of several seconds and snap the beam round.
        this._lastSweepAt = 0
        startCharge(this, aim)
    }

    overchargeOnRepress() { return overcharge(this) }

    tick(hero, aim) {
        // The live aim is the player's click direction refined by _autoAim, so
        // the beam tracks the enemy it is burning. Refined HERE, every frame,
        // rather than inside _fire: chargedCast copies liveAim into cast.aim on
        // every sustain tick, so a refinement applied only at fire time would be
        // overwritten between pulses and the drawn bar would swing back and
        // forth between the click and the target.
        const live = (aim && (aim.dx || aim.dy)) ? this._autoAim(hero, aim) : aim
        const done = chargeTick(this, hero, {
            telegraph: (vec) => this._telegraph(hero, vec),
            fire: (vec, cast) => this._fire(hero, vec, cast),
            liveAim: live,
        })
        // Re-aim the LIT beam every frame toward the cast's current direction.
        // chargedCast updates cast.aim every frame while steering but only calls
        // fire() on the sustain interval, so without this the beam would ignore a
        // click for up to 350ms and then jump. Aiming here and damaging there is
        // the whole point of the split: the picture is continuous, the damage is
        // discrete.
        const current = this._cast?.aim
        if (this._beam?.alive && current && (current.dx || current.dy)) {
            const end = this._reach(hero, current)
            this._beam.update(hero.x, hero.y, end.x, end.y)
        }

        // Sweep the drawn bars toward wherever they are now aimed. This runs on
        // EVERY frame, while _fire only runs on the sustain interval — so a
        // steered beam turns smoothly between damage pulses instead of snapping
        // once every 350ms. The DAMAGE stays on the 8-way vector; only the
        // picture interpolates, so the bar can be up to half a compass point off
        // the lane it is actually burning while it swings.
        const now = Date.now()
        const deltaMs = this._lastSweepAt ? now - this._lastSweepAt : 16
        this._lastSweepAt = now
        this._beam?.step(deltaMs, TURN_RATE)
        this._telegraphBeam?.step(deltaMs, TURN_RATE)
        return done
    }

    // --- internals -----------------------------------------------------------

    // Snap `aim` onto the nearest enemy that stands ON one of the eight lanes
    // out of the caster, within range, reachable (no wall between), and within
    // one compass step of where the player is pointing. Returns `aim` itself
    // when no such enemy exists, so an empty lane still burns where it was
    // pointed. Adjacent enemies are always on a lane — all eight neighbours are
    // — which is exactly the case the old beam lost.
    _autoAim(hero, aim) {
        let best = null
        let bestDist = Infinity
        for (const e of tm.entities) {
            if (e.type !== 'enemy' || !e.sprite || e.healthPoints <= 0) continue
            const dx = e.x - hero.x
            const dy = e.y - hero.y
            const dist = Math.max(Math.abs(dx), Math.abs(dy))
            if (dist === 0 || dist > this.range || dist >= bestDist) continue
            if (!(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) continue   // off every lane
            const dir = { dx: Math.sign(dx), dy: Math.sign(dy) }
            if (compassSteps(aim, dir) > 1) continue
            const end = this._reach(hero, dir)
            if (Math.max(Math.abs(end.x - hero.x), Math.abs(end.y - hero.y)) < dist) continue   // a wall first
            best = dir
            bestDist = dist
        }
        return best || aim
    }

    // Walk the aim until a wall so the telegraph and the shot both stop where
    // the beam actually stops, rather than painting through solid rock.
    _reach(origin, aim) {
        let reach = 0
        for (let i = 1; i <= this.range; i++) {
            const tx = origin.x + aim.dx * i
            const ty = origin.y + aim.dy * i
            // Terrain only, matching the `beam` verb this telegraphs for. It used
            // to ask isWalkableTile, which treats an occupied tile as unwalkable —
            // so the drawn beam stopped dead at the first enemy while the damage
            // (once fixed) carried on past it, and the picture disagreed with the
            // shot. Out of bounds is a stop; a wall is a stop; a body is not.
            if (!mapState.level[ty] || mapState.level[ty][tx] === undefined) break
            if (mapState.level[ty][tx] === 1) break
            reach = i
        }
        return { x: origin.x + aim.dx * reach, y: origin.y + aim.dy * reach }
    }

    // The lane origins for a given overcharge level: the caster's own tile, plus
    // a symmetric pair per stack offset PERPENDICULAR to the aim. Each lane is a
    // separate `beam` call, which is what gives width without a shape spec.
    _laneOrigins(hero, aim, overchargeLevel) {
        const lanes = [{ x: hero.x, y: hero.y }]
        const perpX = -aim.dy
        const perpY = aim.dx
        for (let n = 1; n <= this.overchargeLanes * overchargeLevel; n++) {
            lanes.push({ x: hero.x + perpX * n, y: hero.y + perpY * n })
            lanes.push({ x: hero.x - perpX * n, y: hero.y - perpY * n })
        }
        return lanes
    }

    // Wind-up: motes converge on the caster over a faint pulse along the path —
    // a readable, dodgeable cue rather than a surprise.
    // The gather motes DO repaint each throttle tick — overlapping 300ms tweens
    // that read as a continuous inward stream, which is what they are for. The
    // telegraph BAR is held instead of repainted: a faint bar re-flashed every
    // 160ms pulses, and a pulsing wind-up is the thing that read as a blink.
    _telegraph(hero, aim) {
        playChannelGather(hero, { color: this.fxColor })
        const end = this._reach(hero, aim)
        if (this._telegraphBeam && !this._telegraphBeam.alive) this._telegraphBeam = null
        if (!this._telegraphBeam) {
            this._telegraphBeam = playHeldBeam(hero.x, hero.y, end.x, end.y, {
                color: this.fxColor,
                alpha: TELEGRAPH_ALPHA,
                width: TELEGRAPH_WIDTH,
                core: false,
                fadeMs: 120,
            })
        } else {
            // Re-aim in place — the caster can be steered mid-charge, and the
            // reach changes as enemies move in and out of the lane.
            this._telegraphBeam.update(hero.x, hero.y, end.x, end.y)
        }
    }

    // One pulse. Damage is rolled ONCE per pulse for every lane, so a pulse that
    // catches three enemies reads as one event with one number behind it — same
    // choice The Unraveling made. Overcharge adds flat power to this cast's
    // pulses only and never touches the ability's base fields.
    //
    // The first pulse comes from the fire phase with cast.aim as set at the
    // wind-up (the click); tick() has not refined it yet. Refine here too so the
    // opening pulse already tracks — a cast started at an enemy that stepped
    // sideways during the wind-up should not open on empty floor.
    _fire(hero, aim, cast) {
        aim = this._autoAim(hero, aim)
        cast.aim = aim
        const damage = this.rollDamage(hero) + this.overchargePower * cast.overcharge
        const lanes = this._laneOrigins(hero, aim, cast.overcharge)

        const hits = []
        for (const origin of lanes) {
            hits.push(...beam(origin, aim.dx, aim.dy, {
                length: this.range,
                damage,
                type: this.damageType,
                // A fire scroll's burn, a tome's rider — the weapon's spell
                // empowerment rolls on every survivor the beam touches.
                onHit: (victim) => empowerOnHit(this, hero, victim),
            }))
        }

        // ONE bar for the whole beam, as wide as it is in lanes. The telegraph
        // hands over to the real beam on the first pulse: the wind-up bar is
        // released as the fired bar lights, so there is no frame with both and
        // no frame with neither. Later pulses MOVE the lit bar, never respawn
        // it — respawning is what made a held beam flicker on every re-fire.
        const end = this._reach(hero, aim)
        // Drop a handle whose objects died with a previous floor's scene — the
        // ability instance lives on the hero and outlives the World scene.
        if (this._beam && !this._beam.alive) this._beam = null
        if (this._beam) {
            this._beam.update(hero.x, hero.y, end.x, end.y)
            // Push the fade back so the bar stays continuously lit across the
            // whole sustain window instead of expiring between pulses.
            this._scheduleBeamRelease(BEAM_HOLD_MS)
        } else {
            this._beam = playHeldBeam(hero.x, hero.y, end.x, end.y, {
                color: this.fxColor,
                width: lanes.length * FIRE_WIDTH,
                core: true,
                fadeMs: 260,
            })
            this._releaseTelegraph()
            this._scheduleBeamRelease(BEAM_HOLD_MS)
        }

        return hits
    }

    // Hold the lit beam for `ms`, then fade it once. Every pulse re-arms this,
    // so the bar stays continuously lit for the whole sustain window and fades
    // only after the last pulse.
    _scheduleBeamRelease(ms) {
        const scene = dungeon.scene
        if (!scene) return
        this._beamTimer?.remove()
        this._beamTimer = scene.time.delayedCall(ms, () => {
            this._beam?.release()
            this._beam = null
            this._beamTimer = null
        })
    }

    _releaseTelegraph() {
        this._telegraphBeam?.release()
        this._telegraphBeam = null
    }

    // The cast ENDED normally (finished, or was toggled off). The wind-up
    // telegraph goes immediately — but the lit beam is deliberately LEFT to
    // finish its hold, so the picture outlasts the last pulse by a beat rather
    // than cutting off the instant the phase machine stops.
    // _scheduleBeamRelease already owns its fade.
    onChannelEnd() {
        this._releaseTelegraph()
    }

    // INTERRUPTED by hard CC. Here the beam does go at once, including a lit one:
    // being stunned mid-cast should visibly cut the beam off, and if the shot had
    // not fired yet there is nothing to hold anyway.
    onChannelInterrupt() {
        this._releaseTelegraph()
        this._beamTimer?.remove()
        this._beamTimer = null
        this._beam?.release()
        this._beam = null
    }
}
