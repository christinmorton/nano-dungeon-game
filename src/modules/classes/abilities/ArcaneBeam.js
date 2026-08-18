import Ability from './Ability.js'
import mapState from '../../MapState.js'
import { playBeam, playChannelGather } from '../../Animations.js'
import { shapeStrike } from '../../abilities/patterns.js'
import { startCharge, chargeTick, overcharge } from '../../abilities/chargedCast.js'
import { empowered, quickened, bump } from '../../abilities/traitDefs.js'

// Arcane Beam — a CHARGED energy beam, the first user of the windup → fire →
// ending lifecycle (chargedCast.js). Casting begins a wind-up: the caster locks
// in place and gathers power (a faint beam telegraph pulses where it will strike),
// then FIRES along the aimed line — a uniform-width lance of energy that hits
// EVERY enemy in its path (no chance to dodge/block it; only walls and protective
// abilities stop it). A short ending recovery follows. Phases are paced by
// wall-clock (see chargedCast.js) so the wind-up is visible regardless of how
// fast turns cycle.
//
// Two base forms via OVERCHARGE: tap the key again during wind-up to pour in more
// power — each stack widens the beam (more lanes) and adds attack power, for a
// longer wind-up. 0 stacks = the quick, narrow, weaker beam.
//
// Hard CC during the wind-up interrupts the cast and the shot is lost. Requires
// real magical training (Magic + INT). Magic-pool ability; unslotted.

const ARCANE_TINT = 0xb98bff

export default class ArcaneBeam extends Ability {
    name = 'Mana Beam'
    icon = 31
    description = 'Charge a beam, then fire a line of energy that hits every enemy in its path (no dodge/block). Tap again mid-charge to overcharge — wider + stronger. Needs Magic + INT. cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 5
    target = 'direction'

    // Routed through the Invocation channel driver (HeroController): the caster is
    // locked & stationary while charging, and the cast self-terminates after its
    // ending. Aim-locked (a direction), not entity-locked — so it never breaks on
    // line-of-sight, only on a hard-CC interrupt.
    channeled = true
    invokeVerb = 'channeling Mana Beam'
    breaksOnLineOfSight = false

    // Real magical training to wield — the spec's higher Magic + Intellect gate.
    // First-draft thresholds; tune on the bench. (The training bench flips
    // TRAINING_GATES_OFF so any hero can exercise it regardless.)
    requires = { Magic: 12, INT: 12 }

    // --- charged-cast lifecycle knobs (read by chargedCast.js), in ms ---
    windupMs = 800             // gather power before firing
    fireMs = 220               // hold on the beam flash
    endingMs = 450             // recovery after the shot
    overchargeWindupMs = 450   // each overcharge stack lengthens the windup
    maxOvercharge = 2          // how many extra power stacks a re-press can add
    overchargePower = 25       // flat damage added per overcharge stack
    overchargeWidth = 2        // beam widens by this many lanes per stack

    // --- sustained / steerable channel (the Sustained Beam augment) ---
    // Base (0) = the current single shot. The augment turns the beam into a HELD
    // channel that keeps firing for sustainMs and (steerable) re-aims toward
    // arrow-key input each tick, so the caster can sweep the beam across a room.
    sustainMs = 0
    sustainIntervalMs = 350
    steerable = false

    // Base (uncharged) beam — a quick, narrow line of energy. Overcharge widens
    // it at fire time via fx.shape, so this base footprint stays pristine for the
    // progression snapshot.
    shape = { kind: 'beamLine', length: 5, width: 1 }

    // FX flavor color: arcane violet (the single color knob — a future recolor
    // trait keyed to energy type mutates this).
    fxColor = ARCANE_TINT

    // Payload — rolled per enemy the beam crosses. ~+30 over magicPower at base
    // attack power (the spec's flat bonus); damage bypasses dodge/block because it
    // resolves through the spell path (resolveDamage), not the weapon path.
    damageMin = 28
    damageMax = 32
    damageStat = 'magicPower'
    damageType = 'magic'

    // --- Progression ladder (flat fields only — beam length/range are coupled to
    // the charged-cast machinery, so the ladder scales power / overcharge / tempo) -
    //   L1 : 28..32, up to 2 overcharge stacks
    //   L2 : +4/+4 damage                                                  [boost]
    //   L3 : augment — High Energy (+dmg) | Greater Overcharge (+stack, +power) | Swift Charge (faster windup, cd -1) | Sustained Beam (held + steerable)
    //   L4 : a trait slot — Empowered (+dmg) | Surging (+overcharge power) | Quickened (cd -1)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 4; a.damageMax += 4 },
    }

    augments = {
        highEnergy: { label: 'High Energy', apply: a => { a.damageMin += 10; a.damageMax += 10 } },
        overcharged: { label: 'Greater Overcharge', apply: a => { a.maxOvercharge += 1; a.overchargePower += 10 } },
        swift: { label: 'Swift Charge', apply: a => { a.windupMs = Math.max(200, a.windupMs - 300); a.cooldown = Math.max(0, a.cooldown - 1) } },
        sustained: { label: 'Sustained Beam', apply: a => { a.sustainMs = 1500; a.steerable = true } },   // held + steerable
    }

    traits = {
        empowered: empowered(5),
        surging:   bump('Surging', 'overchargePower', 10),
        quickened: quickened(1),
    }

    // --- channel hooks (called by HeroController) ---
    onChannelStart(aim) { startCharge(this, aim) }

    overchargeOnRepress() { return overcharge(this) }

    // One channel tick — chargeTick runs the wall-clock phase machine and calls
    // back for the windup telegraph and the fire payload. Returns true when the
    // whole sequence (windup → fire → ending) is finished so the channel releases.
    tick(hero, aim) {
        return chargeTick(this, hero, {
            telegraph: (vec) => this._telegraph(hero, vec),
            fire: (vec, cast) => this._fire(hero, vec, cast),
            liveAim: aim,        // sustain phase re-aims toward this (steering)
        })
    }

    // The beam footprint at a given overcharge level — wider per stack, same length.
    _beamShape(overchargeLevel = 0) {
        return {
            kind: 'beamLine',
            length: this.shape.length,
            width: this.shape.width + this.overchargeWidth * overchargeLevel,
        }
    }

    // Walk the aim until a wall to find how far the beam reaches — so both the
    // telegraph and (visually) the shot stop where the beam actually stops.
    _beamReach(hero, aim) {
        let reach = 0
        for (let i = 1; i <= this.range; i++) {
            const tx = hero.x + aim.dx * i
            const ty = hero.y + aim.dy * i
            const row = mapState.level[ty]
            if (!row || row[tx] !== 0) break   // wall / out of bounds
            reach = i
        }
        return { x: hero.x + aim.dx * reach, y: hero.y + aim.dy * reach }
    }

    // Wind-up telegraph: energy motes converge on the caster (the charging /
    // absorption animation) over a faint beam pulsed along the path — a readable,
    // dodge-able cue rather than a surprise. Both read fxColor, so an elemental
    // beam variant recolors the whole charge by changing one field.
    _telegraph(hero, aim) {
        playChannelGather(hero, { color: this.fxColor })
        const end = this._beamReach(hero, aim)
        playBeam(hero.x, hero.y, end.x, end.y, {
            color: this.fxColor,
            width: this.shape.width * 0.55,
            alpha: 0.22,
            duration: 280,
            core: false,
        })
    }

    // Loose the beam: paint the continuous lance (fx.beam) and hit every enemy in
    // it. Overcharge widens the shape (fx.shape) and adds flat power (fx.bonus) for
    // THIS cast only — neither touches the ability's base fields.
    _fire(hero, aim, cast) {
        shapeStrike(this, hero, aim.dx, aim.dy, {
            castType: 'arcane',
            beam: true,
            shape: this._beamShape(cast.overcharge),
            bonus: this.overchargePower * cast.overcharge,
        })
    }
}
