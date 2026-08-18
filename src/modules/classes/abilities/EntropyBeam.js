import Ability from './Ability.js'
import mapState from '../../MapState.js'
import { playBeam, playChannelGather } from '../../Animations.js'
import { shapeStrike } from '../../abilities/patterns.js'
import { startCharge, chargeTick, overcharge } from '../../abilities/chargedCast.js'
import { applyCorruption } from '../../tags/corruption.js'
import { empowered, quickened, bump } from '../../abilities/traitDefs.js'

// Entropy Beam — the Void tree's CHARGED capstone: a beam of raw chaos/entropy.
// Same windup → fire → ending lifecycle as Mana Beam (chargedCast.js), but where
// the arcane beam is pure force, this one UNMAKES — every enemy the beam crosses
// takes void damage AND a stack of Corruption (the stacking void DoT, tags/
// corruption.js). Sweep it across a pack and watch the corruption pile up, then
// tick them all down. Overcharge widens + strengthens it; the Withering augment
// pours on extra corruption stacks. Aim-locked direction channel; hard CC during
// the windup interrupts the shot. Needs real void/magical training. Library/
// unslotted (Void / `devotion(void)`).

const VOID_TINT = 0x7a2fa0          // void violet

export default class EntropyBeam extends Ability {
    name = 'Entropy Beam'
    icon = 31
    description = 'Charge a beam of entropy, then fire a line that hits every enemy in its path (no dodge/block) — void damage + a stack of Corruption. Tap again mid-charge to overcharge. Needs Magic + INT. cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'direction'

    channeled = true
    invokeVerb = 'channeling Entropy Beam'
    breaksOnLineOfSight = false

    requires = { Magic: 12, INT: 12 }

    // --- charged-cast lifecycle knobs (read by chargedCast.js), in ms ---
    windupMs = 800
    fireMs = 220
    endingMs = 450
    overchargeWindupMs = 450
    maxOvercharge = 2
    overchargePower = 18            // flat void damage per overcharge stack
    overchargeWidth = 2

    // --- sustained / steerable channel (the Unmaking Beam augment) ---
    sustainMs = 0
    sustainIntervalMs = 350
    steerable = false

    shape = { kind: 'beamLine', length: 5, width: 1 }
    fxColor = VOID_TINT

    // Lower direct damage than Mana Beam — the Corruption DoT carries the rest.
    damageMin = 18
    damageMax = 24
    damageStat = 'magicPower'
    damageType = 'magic'

    // Corruption rider applied to every enemy the beam crosses (stacking void DoT).
    corruptionPerStack = 4
    corruptionTurns = 4
    corruptionMaxStacks = 5
    corruptionStacksPerHit = 1     // Withering augment bumps this

    // --- Progression ladder ----------------------------------------------------
    //   L1 : 18..24 void · 1 Corruption stack/hit · up to 2 overcharge
    //   L2 : +1 corruption/turn per stack                                  [boost]
    //   L3 : augment — High Entropy (+dmg) | Withering (2 stacks/hit, +cap) | Swift Charge | Unmaking Beam (held + steerable)
    //   L4 : a trait slot — Empowered | Virulent (+corruption dmg) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.corruptionPerStack += 1 },
    }

    augments = {
        highEntropy: { label: 'High Entropy', apply: a => { a.damageMin += 8; a.damageMax += 8 } },
        withering:   { label: 'Withering',    apply: a => { a.corruptionStacksPerHit += 1; a.corruptionMaxStacks += 3 } },
        swift:       { label: 'Swift Charge',  apply: a => { a.windupMs = Math.max(200, a.windupMs - 300); a.cooldown = Math.max(0, a.cooldown - 1) } },
        unmaking:    { label: 'Unmaking Beam', apply: a => { a.sustainMs = 1500; a.steerable = true } },
    }

    traits = {
        empowered: empowered(4),
        virulent:  bump('Virulent', 'corruptionPerStack', 2),
        quickened: quickened(1),
    }

    // --- channel hooks (called by HeroController) ---
    onChannelStart(aim) { startCharge(this, aim) }

    overchargeOnRepress() { return overcharge(this) }

    tick(hero, aim) {
        return chargeTick(this, hero, {
            telegraph: (vec) => this._telegraph(hero, vec),
            fire: (vec, cast) => this._fire(hero, vec, cast),
            liveAim: aim,
        })
    }

    _beamShape(overchargeLevel = 0) {
        return {
            kind: 'beamLine',
            length: this.shape.length,
            width: this.shape.width + this.overchargeWidth * overchargeLevel,
        }
    }

    _beamReach(hero, aim) {
        let reach = 0
        for (let i = 1; i <= this.range; i++) {
            const tx = hero.x + aim.dx * i
            const ty = hero.y + aim.dy * i
            const row = mapState.level[ty]
            if (!row || row[tx] !== 0) break
            reach = i
        }
        return { x: hero.x + aim.dx * reach, y: hero.y + aim.dy * reach }
    }

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

    // Loose the beam: paint the lance, hit every enemy in it, AND stack Corruption
    // on each survivor (the void DoT rider — the beam's identity).
    _fire(hero, aim, cast) {
        const results = shapeStrike(this, hero, aim.dx, aim.dy, {
            castType: 'arcane',
            beam: true,
            shape: this._beamShape(cast.overcharge),
            bonus: this.overchargePower * cast.overcharge,
        })
        for (const { entity, result } of results) {
            if (result.killed) continue
            for (let s = 0; s < this.corruptionStacksPerHit; s++) {
                applyCorruption(entity, this.corruptionPerStack, this.corruptionTurns, this.corruptionMaxStacks)
            }
        }
    }
}
