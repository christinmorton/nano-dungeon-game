import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import gameLog from "../GameLog.js"
import audio from "../Audio.js"
import { applyStatuses } from "../hazards/Hazards.js"
import { resolveDamage, teleport } from "../abilities/universals.js"
import { playCast, playBeam, playBurst, playAreaRing } from "../Animations.js"
import barrier from "./barrier.js"

// darkPriestCaster — signature moves for the Dark Sorcerer (scope doc §10.12).
//
// WHAT THIS IS NOT: an enemy ability system. BaseEnemy has no ability plumbing
// and this does not give it any. It is a Taggable tag that WRAPS turn(), the way
// eliteEnrager wraps construction — the archer archetype keeps driving movement
// and kiting, and this only intercepts the moment a shot would be fired to cast
// something better instead. If a second caster ever wants moves, THAT is when a
// general system earns its place; one enemy does not justify a subsystem in a
// project whose whole premise is shipping.
//
// Every move is built on a status v5 ALREADY ships, so the §5 status cap of 12
// does not move. Nothing here invents a mechanic.
//
// THE DESIGN PROBLEM IT SOLVES: a caster that only plinks is a worse archer. The
// wand does 1-4. Raising that number makes it a better plinker, not a threat.
// These moves make it dangerous because of what it DOES to you — it curses, it
// weakens, it roots you in the open — and they are TELEGRAPHED, so the danger is
// something the player can read and respond to rather than a bigger number
// arriving without warning.

const CAST_COLOR = 0x9b59d0

// Cooldowns are per-move and generous. A caster that could cast every round
// would be a stunlock; the gaps are when it falls back to its wand, which is
// what makes landing a move feel like the priest got one off rather than like
// a metronome.
// How far a Shadowstep lands from the player, and how far it may travel.
const STEP_MIN_FROM_PLAYER = 3
const STEP_MAX_FROM_PLAYER = 6
const STEP_REACH = 7

const MOVES = [
    {
        // FIRST, so it wins the priority scan: the priest's escape (scope doc
        // §10.18). Only when the player is CLOSE — the archer AI's one-tile
        // retreat is what made the old priest walkable-down. It blinks to a tile
        // in its own room three to six tiles from the player, in line of sight,
        // and the next round it is shooting again from the far side.
        key: "shadowstep",
        name: "Shadowstep",
        cooldown: 4,
        maxRange: 2,
        cast(priest, target) {
            const dest = pickShadowstepTile(priest, target)
            if (!dest) return false
            gameLog.log(`The ${priest.name} folds into shadow and reappears across the room!`)
            playBurst(priest.x, priest.y, { radius: 1, color: CAST_COLOR })
            teleport(priest, dest.x, dest.y)
            playCast(priest, { type: "arcane" })
            audio.play('ability-blink')
            return true
        },
    },
    {
        key: "curse",
        name: "Withering Curse",
        cooldown: 5,
        minRange: 2,
        // The signature. Corrupted is the arcane DoT added in §10.8 — the damage
        // follows the victim out of the blast rather than stopping when they step
        // away, which is exactly what a curse should do.
        cast(priest, target) {
            gameLog.log(`The ${priest.name} raises its hands and speaks a withering word!`)
            playBeam(priest.x, priest.y, target.x, target.y, { color: CAST_COLOR })
            // resolveDamage(victim, rawDamage, damageType, opts) — threading the
            // priest as `attacker` keeps armour-pen and outgoing multipliers in
            // the normal path rather than bypassing the damage pipeline.
            const roll = 5 + Math.floor(Math.random() * 5)   // 5-9
            resolveDamage(target, roll, "magic", { attacker: priest })
            applyStatuses(target, "Corrupted")
        },
    },
    {
        key: "enfeeble",
        name: "Enfeeble",
        cooldown: 7,
        minRange: 2,
        // Weaken is the priest's answer to a player who out-damages it. No damage
        // of its own on purpose: a move that ONLY debuffs reads as a caster
        // setting up, and gives the player a reason to close rather than trade.
        cast(priest, target) {
            gameLog.log(`The ${priest.name}'s eyes go white — your strength ebbs away.`)
            playCast(priest, { type: "arcane" })
            playBurst(target.x, target.y, { radius: 1, color: CAST_COLOR })
            // "Weaken", not "Weakened" — applyStatuses matches the status's
            // registered `name` exactly, and an unknown name is SKIPPED IN
            // SILENCE (its own comment says so), so a typo here would cost the
            // move its entire effect with no error.
            applyStatuses(target, "Weaken")
        },
    },
    {
        key: "bind",
        name: "Shadowbind",
        cooldown: 6,
        // Only worth casting when the player is CLOSING — rooting someone already
        // at range hands them a free turn to shoot back. Gated below by distance.
        minRange: 2,
        maxRange: 4,
        // Rooted stops movement but not attacks, so this is a kiter's escape
        // tool rather than a stunlock: it buys the priest distance, it does not
        // take the player's turn away.
        cast(priest, target) {
            gameLog.log(`Shadows coil around ${target.name}'s feet!`)
            playAreaRing(target.x, target.y, 1, { color: CAST_COLOR, fade: 400 })
            applyStatuses(target, "Rooted")
        },
    },
]

// A Shadowstep destination: a free floor tile within STEP_REACH of the priest,
// inside the priest's room when it stands in one, STEP_MIN..STEP_MAX tiles from
// the player, with a clear line of sight back so it can shoot. The furthest
// such tile wins; ties fall to chance so the same corner is not picked twice.
function pickShadowstepTile(priest, target) {
    const room = mapState.roomAt(priest.x, priest.y)
    let best = null
    let bestDist = -1
    for (let dy = -STEP_REACH; dy <= STEP_REACH; dy++) {
        for (let dx = -STEP_REACH; dx <= STEP_REACH; dx++) {
            const x = priest.x + dx, y = priest.y + dy
            if (dx === 0 && dy === 0) continue
            if (room && !room.contains(x, y)) continue
            if (!mapState.isWalkableTile(x, y) || mapState.entityAtTile(x, y)) continue
            const d = Math.max(Math.abs(target.x - x), Math.abs(target.y - y))
            if (d < STEP_MIN_FROM_PLAYER || d > STEP_MAX_FROM_PLAYER) continue
            if (!mapState.hasLineOfSight({ x, y }, target)) continue
            if (d > bestDist || (d === bestDist && Math.random() < 0.5)) { best = { x, y }; bestDist = d }
        }
    }
    return best
}

// Pick and fire one ready move for `priest`. Returns true if something cast.
//
// A MODULE FUNCTION, NOT A TAG METHOD. addTag() iterates EVERY key on the
// template and calls wrapFunction() on each, which captures `this[key]` as the
// "original" and replaces it with a wrapper that calls it. A key the entity has
// no method for therefore captures `undefined` and throws
// "Cannot read properties of undefined (reading 'apply')" the moment the tag
// fires. A tag template is a map of HOOK NAMES ONLY — `initialize`, `cleanup`,
// and methods the entity actually has (turn/attack/blockAttack/onDestroy, as
// eliteEnrager uses). Helpers live out here.
//
// Deliberately does NOT gate on actionPoints: this runs after the archetype's
// turn, by which point the AP is already spent. The cooldowns ARE the rate
// limit, and they are what stop this becoming a second attack every round.
function tryCast(priest) {
    if (priest.healthPoints <= 0) return false
    if (!priest.isEngaged || !priest.isEngaged()) return false

    const target = dungeon.player
    if (!target || target.healthPoints <= 0) return false

    const distance = Math.max(Math.abs(target.x - priest.x), Math.abs(target.y - priest.y))

    // A spell needs a clear lane exactly as the wand does — a priest casting
    // through a wall would be worse than one that cannot see you. `true` =
    // magic projectile, so only an arcane wall stops it.
    if (!mapState.hasProjectilePath(priest, target, priest, true)) return false

    for (const move of MOVES) {
        if (priest._casterCooldowns[move.key] > 0) continue
        if (move.minRange != null && distance < move.minRange) continue
        if (move.maxRange != null && distance > move.maxRange) continue
        // A move may decline (Shadowstep with nowhere to go) by returning false;
        // it then costs nothing and the scan moves on to the next ready move.
        const fired = move.cast(priest, target)
        if (fired === false) continue
        if (move.key !== "shadowstep") audio.play('ui-skill')
        priest._casterCooldowns[move.key] = move.cooldown
        return true
    }
    return false
}

// The Corrupted Skull's gift (scope doc §10.18), read each round: while the
// priest's skull stands, its cooldowns tick twice, and every WARD_EVERY rounds
// it re-raises a barrier on itself if it has none. `priest._skull` is set by
// the spawner and cleared by the skull's own onDestroy.
const WARD_EVERY = 6
function skullAlive(priest) {
    const s = priest._skull
    return !!(s && s.sprite && s.healthPoints > 0)
}

const darkPriestCaster = {
    name: "Dark Priest Caster",

    initialize: function () {
        if (this.type !== "enemy") return
        // Per-move cooldown clocks. Staggered at spawn so a priest cannot open
        // with all three at once — the first thing it does is one move, then its
        // wand, which teaches the pattern before it doubles up.
        this._casterCooldowns = {}
        MOVES.forEach((m, i) => { this._casterCooldowns[m.key] = i })
        this._skullWardIn = 0
    },

    // Taggable is NOT a next()-style middleware chain: wrapFunction runs the
    // ORIGINAL method first and then calls the handler with (returnValue,
    // ...args). So this fires AFTER the archetype has already taken its turn,
    // which is why a cast here does not consume the archetype's action point —
    // it has already spent it on a wand shot or skipped it.
    //
    // That ordering is actually the one we want. The priest shoots or kites as
    // an archer, and a ready move lands ON TOP as a second, occasional beat, so
    // the caster reads as an archer that sometimes does something much worse.
    // Casting INSTEAD of the archetype's turn would mean rewriting the kiting,
    // and the AP bookkeeping in archer.js warns what happens when a turn path
    // leaves actionPoints unspent: the round never ends and the hero never gets
    // movement back.
    turn: function (ret) {
        if (this.type !== "enemy" || !this._casterCooldowns) return ret

        const empowered = skullAlive(this)
        const tick = empowered ? 2 : 1
        for (const key of Object.keys(this._casterCooldowns)) {
            if (this._casterCooldowns[key] > 0) this._casterCooldowns[key] = Math.max(0, this._casterCooldowns[key] - tick)
        }
        if (empowered && this.healthPoints > 0 && this.isEngaged?.()) {
            if (this._skullWardIn > 0) this._skullWardIn -= 1
            else if (!this._tags?.includes("Barrier")) {
                this.addTag(barrier, 4, 6, CAST_COLOR)
                this._skullWardIn = WARD_EVERY
            }
        }
        tryCast(this)
        return ret
    },

}

export default darkPriestCaster
