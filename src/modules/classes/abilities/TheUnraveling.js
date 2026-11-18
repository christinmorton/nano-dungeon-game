import Ability from './Ability.js'
import dungeon from '../../Dungeon.js'
import { shockwave } from '../../abilities/universals.js'
import { playAreaOutline, playBurst, playImpact, playSplash } from '../../Animations.js'
import { shapeOffsets } from '../../abilities/shapes.js'
import ZoneEffect from '../../hazards/ZoneEffect.js'
import { footprintTiles } from '../../hazards/Hazards.js'
import { applyCorruption } from '../../tags/corrupted.js'
import { applyStun } from '../../tags/stun.js'
import { empowerOnHit } from '../../abilities/empower.js'

// Wizard ULTIMATE — The Unraveling. A massive arcane detonation that unmakes a
// wide area: huge magic damage to everything caught. The caster capstone, and a
// class SIGNATURE rather than something gated on stats, so there is no `requires`.
// aoeTile skillshot. tier:'ultimate'.
//
// v3 delivered this through `areaStrike` in patterns.js. v5's patterns file was
// written small on purpose (five, against v3's ~30), so rather than port a sixth
// pattern for one ability this is rebuilt on `shockwave` from universals.js —
// which already does the job: a radius sweep applying resolveDamage to every
// enemy caught, with its own expanding-ring flourish. Scope doc §10.5.
//
// Damage is SELF-COMPUTED (the spell model, not the weapon-delegated one):
// rollDamage() returns caster.stat('magicPower') + Between(damageMin, damageMax).

const ARCANE_TINT = 0x9a7bff

export default class TheUnraveling extends Ability {
    name = 'The Unraveling'
    icon = 17
    // Kept under ~132 characters: this string is also what the class-select card
    // prints, and the card budgets wrapped lines per ability. See Intro.js CARD_H.
    description = 'Unmake an area: 3.5x spell power + 30..40 arcane damage, stunning all it hits and leaving corrupted ground for 3 rounds. cd 12.'
    cost = { ap: 1, mp: 0 }
    cooldown = 12
    range = 7
    target = 'aoeTile'
    tier = 'ultimate'
    radius = 3
    shape = { kind: 'circle', radius: 3 }
    fxColor = ARCANE_TINT

    // Rescaled 2026-10-04 (scope doc §10.16): was magicPower + 22..32 (37-47 at
    // Magic 15). A capstone on a 12-round cooldown should delete a room.
    damageScale = 3.5
    damageMin = 30
    damageMax = 40
    damageStat = 'magicPower'
    damageType = 'magic'
    element = 'arcane'        // empowered by a weapon's `all` entry (§10.16)
    // Every survivor is STUNNED (user's call, 2026-10-04): the room it does not
    // kill, it stops. Two turns — one is a slam's worth, and this is the
    // capstone. applyStun refreshes an existing stun rather than no-op'ing.
    stunTurns = 2

    // --- the lingering residue -------------------------------------------------
    // The blast leaves the space it tore open still coming apart: tiles that keep
    // damaging whatever stands in them for a few rounds after the detonation.
    //
    // This is a real mechanic rather than decoration, and it cost almost nothing
    // because ZoneEffect was already here -- damage per round, statuses, duration,
    // tile registration, self-expiry, on-enter triggers through
    // Dungeon.moveEntityTo. Traps already use it, so the path is live in play and
    // not dormant code. Seventh time on this port that the socket was wired and
    // only the bulb was missing.
    //
    // The residue applies CORRUPTED, v5's twelfth status, added for this on
    // 2026-09-20 and recorded in scope doc §10.8 BEFORE any of this was written.
    // Burning and poison were both considered and rejected on flavour — "set
    // ablaze" and "is poisoned" are the wrong words for an arcane unmaking, and a
    // status communicates mostly through its log line and its tint.
    //
    // The status is what makes the residue read as a CURSE rather than a hazard:
    // flat zone damage would stop the moment an enemy stepped off the tile, while
    // corruption follows them out of the blast and keeps ticking.
    residueRounds = 3
    residueDamageMin = 10
    residueDamageMax = 16
    // Corruption carried OUT of the zone, on its own timer. Lower than standing in
    // the residue, so fleeing the pool is a real improvement over standing in it
    // rather than a formality.
    corruptionDamage = 5
    corruptionTurns = 3
    // Smaller than the blast itself. The detonation is radius 3; the residue is
    // the core of it, so escaping the lingering damage is a step or two rather
    // than a sprint, and the ultimate does not fence off a third of the room.
    residueRadius = 2

    activate(hero, target) {
        const tile = target.tile
        // Rolled ONCE for the whole detonation rather than per victim, so a blast
        // that catches four enemies reads as one event with one number behind it.
        const damage = this.rollDamage(hero)
        const hits = shockwave(tile, {
            radius: this.radius,
            damage,
            type: this.damageType,
            fxColor: this.fxColor,
            // shockwave calls this for SURVIVORS only: stun them, then let the
            // caster's weapon roll its spell riders (a fire tome's burn).
            onHit: (victim) => {
                applyStun(victim, this.stunTurns)
                empowerOnHit(this, hero, victim)
            },
        })
        // Snapshot WHERE each hit landed, now. A killed victim is removed from the
        // map by resolveDamage before the delayed impact fires, and its x/y would
        // be stale or gone — so the coordinates travel, not the entities.
        const struckTiles = hits.map(h => ({ x: h.entity.x, y: h.entity.y }))
        this._playDetonation(tile, struckTiles)
        this._leaveResidue(tile)
        return hits
    }

    // Leave the torn space behind. footprintTiles filters to walkable floor, so
    // the residue never paints onto walls and never covers a tile nothing could
    // stand on anyway.
    //
    // `affects: 'enemy'` is deliberate. The hero aims this at their own feet often
    // enough -- it is a panic button as much as an opener -- and an ultimate that
    // punishes you for using it at close range is an ultimate people stop using.
    // It also sidesteps the question of what happens when the residue outlives the
    // fight and the player has to walk back through it to reach the stairs.
    _leaveResidue(tile) {
        const tiles = footprintTiles(tile.x, tile.y, this.residueRadius)
        if (!tiles.length) return
        new ZoneEffect(tiles, {
            kind: 'default',            // the arcane violet in ZONE_STYLE
            duration: this.residueRounds,
            damage: { min: this.residueDamageMin, max: this.residueDamageMax },
            damageFlavor: this.damageType,
            affects: 'enemy',
            // onTickFn rather than the `onTick` status list: that path goes
            // through Hazards.applyStatuses -> addTag, which dedups BY NAME and so
            // silently no-ops on an already-corrupted victim. Standing in the pool
            // would then stop refreshing the timer and an enemy could walk out
            // clean while still in the zone. applyCorruption takes the refresh
            // path instead.
            onTickFn: (entity) => {
                applyCorruption(entity, this.corruptionDamage, this.corruptionTurns)
            },
            // Stepping IN corrupts immediately, rather than waiting for the round
            // to tick over — walking into an unmade space should cost something
            // the moment you do it.
            onEnterFn: (entity) => {
                applyCorruption(entity, this.corruptionDamage, this.corruptionTurns)
            },
        })
    }

    // The ultimate's presentation, layered from primitives Animations.js already
    // has. shockwave draws ONE 280ms ring and playAreaOutline fades in 220ms —
    // on a 12-turn cooldown capstone that reads as a flash you can miss by
    // blinking, which is exactly what playtesting reported (2026-09-20).
    //
    // Nothing here touches damage: every hit is already resolved by the time this
    // runs, so a dropped frame or a missing scene costs visuals and never a hit.
    // Staged over ~700ms in four beats, because a single instant is what made it
    // read as nothing happening:
    //   0ms    the footprint snaps on, held long enough to actually see
    //   0-260  the blast eats outward tile by tile, ordered by distance, so the
    //          unmaking travels instead of appearing everywhere at once
    //   90/180 two more rings behind the first — one wide and slow, one tight
    //   260    a hard flash on every tile that actually took damage
    _playDetonation(tile, struckTiles = []) {
        const scene = dungeon.scene
        playAreaOutline(tile.x, tile.y, this.shape, {
            color: this.fxColor, pulse: false, fade: 620,
        })
        if (!scene) return

        // Ordered near-to-far so the detonation expands rather than blinking in.
        const offsets = shapeOffsets(this.shape, 0, 0)
            .slice()
            .sort((a, b) => a.dist - b.dist)
        const spread = 260
        const maxDist = offsets.length ? offsets[offsets.length - 1].dist : 1
        for (const o of offsets) {
            scene.time.delayedCall((o.dist / (maxDist || 1)) * spread, () => {
                playSplash(tile.x + o.dx, tile.y + o.dy, { color: this.fxColor })
            })
        }

        // Echo rings. The second is wider and lands late; the third is tight and
        // bright, so the blast has a core as well as a reach.
        scene.time.delayedCall(90, () => {
            playBurst(tile.x, tile.y, { radius: this.radius + 1.5, color: this.fxColor })
        })
        scene.time.delayedCall(180, () => {
            playBurst(tile.x, tile.y, { radius: this.radius * 0.5, color: 0xffffff })
        })

        // A hard impact on each tile that actually connected — the part that tells
        // the player the ultimate DID something, distinct from the decorative
        // footprint around it.
        scene.time.delayedCall(260, () => {
            for (const pos of struckTiles) {
                playImpact(pos.x, pos.y, { color: this.fxColor })
            }
        })
    }
}
