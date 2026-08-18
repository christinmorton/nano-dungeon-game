import tm from '../TurnManager.js'
import gameLog from '../GameLog.js'
import emboldened from '../tags/emboldened.js'
import mapState from '../MapState.js'
import Battle from './Battle.js'

// EncounterManager — owns the active Battles on the current floor and the
// derived in-/out-of-combat state. Runs once per World.update tick, BEFORE
// the turn loop, so battle membership is current when enemies take their turn.
// See documents/v3_combat_infrastructure.md.
//
// Slice 1 scope: form a battle when the player meets alerted hostiles, gather
// nearby alerted enemies into its roster, prune the dead, and end the battle
// ('won') when its roster is cleared. Distance activation falls out for free:
// an alerted enemy outside the arena radius stays "loose" (its archetype idle
// path, because isEngaged() is now battle membership) until the player closes
// the distance — so the floor no longer swarms.
//
// Presentation slice (2026-05-29): update() now returns the newly-formed
// battle so the World can fire the intro beat (UI banner) + draw the arena
// overlay (ArenaView). Enemies are kept inside the arena by the clamp in
// Dungeon.stepEntityTo; the hero leaving ends the battle 'fled' (interim —
// see the note in update()). The rolled Retreat ability + Emboldened buff +
// hard barrier tiles still layer on later.

const ARENA_RADIUS = 5   // tiles, Euclidean — fixed circular radius (doc lean)

// Rounds after a player break-off during which the abandoned enemies won't be
// re-recruited into a new arena — the window that lets a successful Retreat /
// walk-out actually get the player away instead of snapping back into combat.
const RETREAT_GRACE = 5

// Rounds after a fight resolves during which NO enemy can notice the hero (a
// hero-wide perception suppression, read in BaseEnemy.updatePerception via
// hero.unnoticeableUntil). Distinct from RETREAT_GRACE: that stops re-recruiting
// the abandoned roster; this is the "dust settles" beat so the rest of the floor
// doesn't snap to alert the moment the arena dissolves.
const POST_BATTLE_GRACE = 5

// TEMPORARY arena scope (2026-06-02) — while the arena mechanic is being
// debugged, fights are kept deliberately simple:
//   - ARENA_MAX_ROSTER caps an arena at a single enemy (a 1-on-1 duel). Extra
//     alerted foes inside the ring wait (phased) until that duel ends, then
//     seed their own.
//   - GROUPS_USE_ARENAS = false makes squads/captains opt OUT of seeding or
//     joining arenas: a group never STARTS a duel — when the player meets one
//     with no duel active, it fights the pre-arena way (free-for-all on alert;
//     see BaseEnemy.isEngaged). But a duel, once active, isolates everything:
//     squads inside the ring still phase out, and all squads stand down (no
//     free-for-all) until it ends, so nothing interferes with the 1-on-1.
// Restore the original multi-enemy / squad-arena behavior by raising
// ARENA_MAX_ROSTER (e.g. back to 7) and setting GROUPS_USE_ARENAS = true.
const ARENA_MAX_ROSTER = 1
const GROUPS_USE_ARENAS = false

// An enemy "belongs to a group" if it's a captain or carries squad membership
// (RecipeApplier sets enemy.squad to the band's captain).
function isGrouped(enemy) {
    return enemy.archetype === 'captain' || enemy.squad != null
}

// Whether this enemy opts out of SEEDING/JOINING arenas (it won't start or be
// pulled into a duel; it fights free-for-all instead). It can still be phased
// out while standing inside someone else's active duel. Squads opt out while
// GROUPS_USE_ARENAS is off.
function optsOutOfArena(enemy) {
    return !GROUPS_USE_ARENAS && isGrouped(enemy)
}

function distSq(a, b) {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return dx * dx + dy * dy
}

// Whether an enemy may cross into an ACTIVE arena and add itself to the fight.
// Everyone else treats the arena as a separate dimension they can't perceive
// (they phase out — see syncPhasing). This is the anti-overwhelm knob: a random
// patrol wandering past no longer piles onto an ongoing fight. Two ways in:
//   - Room affiliation: the enemy spawned in the same room the battle formed
//     in. The room's own cohort can trickle into its fight, but a chance
//     wanderer (different/no spawnRoom) stays out. An enemy that already left
//     its room is excluded for free — joining still requires being inside the
//     ring, and we never reach past it to drag anyone back.
//   - Explicit marker: a Reinforcer / Enemy-Support tag, for deliberate
//     "rush in from outside" units regardless of where they spawned.
// See documents/v3_objective_driven_encounters.md.
function canReinforce(enemy, battle) {
    if (battle && battle.room && enemy.spawnRoom === battle.room) return true
    return !!enemy._tags
        && (enemy._tags.includes('Reinforcer') || enemy._tags.includes('Enemy-Support'))
}

class EncounterManager {
    constructor() {
        this.battles = []
        // Outcome of the most recently resolved battle ('won' | 'fled' | …) and
        // the anchor tile it formed on, read by World when it emits 'combat-end'
        // so the UI can flash the closing banner at the arena's center. The
        // battle is gone from the list by then, so we snapshot these on resolve.
        // Overwritten each time a battle ends; never cleared.
        this.lastOutcome = null
        this.lastAnchorX = null
        this.lastAnchorY = null
    }

    get inCombat() {
        return this.battles.some(b => b.active)
    }

    // Cleared on every floor entry (World.create). Battle refs would otherwise
    // dangle onto entities torn down by tm.cleanup on the floor transition.
    reset() {
        for (const b of this.battles) {
            if (b.active) b.end('won', tm.tickCount)
        }
        this.battles = []
    }

    // Returns the battle that newly formed this tick (so the World can fire
    // the intro beat), or null. All other lifecycle work happens as a side
    // effect on the battle list.
    update(hero) {
        if (!hero || !hero.sprite) return null

        // 1) Prune dead roster members; end battles whose roster emptied.
        //    Also break off battles the hero has walked out of: fled-on-exit.
        //    INTERIM (2026-05-29) — the doc's intended player-side boundary is
        //    the rolled Retreat ability (with an Emboldened buff / fail
        //    penalty), which is deferred with the rest of the flee slice. Until
        //    then the hero CAN leave the arena; ending the battle 'fled' here
        //    keeps combat state coherent (no inCombat stuck true, overlay torn
        //    down) instead of half-building Retreat now. The enemy-side clamp
        //    in Dungeon.stepEntityTo keeps the roster inside meanwhile.
        let endedAny = false
        for (const battle of this.battles) {
            if (!battle.active) continue
            battle.pruneDead()
            // Resolve through the battle's objective ('eliminate' by default →
            // 'won' on an empty roster, same as before). The walk-out flee is a
            // separate, objective-agnostic exit, so it's checked only when the
            // objective hasn't already decided the fight.
            const outcome = battle.objective.evaluate(battle)
            if (outcome) {
                this._recordOutcome(battle, outcome)
                battle.end(outcome, tm.tickCount)
                endedAny = true
                if (outcome === 'won') gameLog.log('The fight is won!')
            } else if (!battle.contains(hero.x, hero.y)) {
                this._concede(battle)
                endedAny = true
            }
        }
        this.battles = this.battles.filter(b => b.active)

        // Expose the hero's current arena (if any) for the Combat damage guard:
        // only this battle's roster may damage the hero while it's active. Set
        // here, before the loose/seed early-returns, so it's fresh every tick.
        hero._arenaBattle = this.battlesWith(hero)[0] || null

        // Post-battle grace: when a fight resolves and the hero is fully out of
        // combat, give them a brief unnoticeable window so the floor's other
        // enemies don't re-detect them the instant the arena dissolves. Granted
        // only once combat has fully ended (not while another battle is still
        // live), so it reads as "the dust settles" rather than mid-fight.
        if (endedAny && !this.inCombat) this._grantPostBattleGrace(hero)

        // 2) Alerted hostiles not yet committed to a battle.
        const loose = []
        for (const e of tm.entities) {
            if (e.type !== 'enemy') continue
            if (e.battle) continue
            if (optsOutOfArena(e)) continue   // squads ignore arenas — free-for-all instead
            if (e.fleeing) continue   // a fleeing enemy is breaking off — don't yank it back in
            if (e.disengageUntil && e.disengageUntil > tm.tickCount) continue   // post-retreat grace
            if (!e.alerted) continue
            loose.push(e)
        }
        if (loose.length === 0) return null

        // 3) Reinforce an existing arena the enemy already stands inside —
        //    but ONLY if the enemy is join-eligible AND the arena isn't sealed
        //    at capacity. A non-eligible enemy inside an active arena is NOT
        //    unseated (it won't seed a new fight); it just stays out of the
        //    roster and gets phased out by syncPhasing. Enemies outside every
        //    arena are the candidates to seed a new one.
        const unseated = []
        for (const enemy of loose) {
            const arena = this.battles.find(b => b.active && b.contains(enemy.x, enemy.y))
            if (arena) {
                // add() returns true only on an actual admission (eligible and
                // not sealed), so the join message fires exactly once per join.
                // The roster cap gates reinforcement: at ARENA_MAX_ROSTER = 1 an
                // arena is already full, so no one joins — the enemy stays loose
                // and is phased out (waiting its turn) by syncPhasing.
                if (arena.roster.size < ARENA_MAX_ROSTER
                    && canReinforce(enemy, arena) && arena.add(enemy)) {
                    gameLog.log(`The ${enemy.name} joins the fight!`)
                }
            } else {
                unseated.push(enemy)
            }
        }
        if (unseated.length === 0) return null

        // 4) Form a new arena anchored on the player (the point where contact
        //    happens) and pull in every alerted hostile within its radius.
        //    Anyone outside stays loose until the player closes in — the
        //    distance-activation leash.
        //
        //    Two gates before a new arena can form:
        //    a) Single-arena invariant. If the hero is already inside an active
        //       battle, DON'T spin up a second one. The anchor is frozen at
        //       formation but the hero keeps moving, so "inside arena A" and
        //       "within radius of the hero now" drift apart — without this guard
        //       a fresh alerted enemy near the moving hero would seed an
        //       overlapping ghost arena (the duplicate-per-encounter bug). New
        //       enemies fold into the existing fight (step 3) or stay loose.
        //    b) Rooms only. An arena is a room thing. Contact in a corridor
        //       stays a free-for-all (no overlay, no clamp) — the enemies just
        //       use their archetype AI, which in a 1-wide hall reads as the
        //       single-file fight the arena framing got wrong.
        if (this.battlesWith(hero).length > 0) return null
        const heroRoom = mapState.rooms?.find(r => r.contains(hero.x, hero.y)) || null
        if (!heroRoom) return null
        // c) Not on the stairs. Forming an arena on the exit tile fires the
        //    intro beat (which pauses) the same frame the player is descending,
        //    and the floor transition then strands that pause onto the next
        //    floor. Getting spotted while literally leaving the level shouldn't
        //    start a fight — let the descent happen.
        if (this._onStairs(hero)) return null

        const battle = new Battle(hero.x, hero.y, ARENA_RADIUS, tm.tickCount)
        battle.room = heroRoom   // so the room's own cohort can reinforce it
        // Pull in the nearest contained foe(s) up to ARENA_MAX_ROSTER (1 → a
        // duel). Sorting by distance makes the closest foe the one engaged;
        // any others stay loose and seed their own duel once this one ends.
        const contained = unseated
            .filter(enemy => battle.contains(enemy.x, enemy.y))
            .sort((a, b) => distSq(a, hero) - distSq(b, hero))
        for (const enemy of contained) {
            if (battle.roster.size >= ARENA_MAX_ROSTER) break
            battle.add(enemy)
        }
        if (battle.roster.size > 0) {
            this.battles.push(battle)
            const n = battle.roster.size
            gameLog.log(n === 1 ? 'A fight breaks out!' : `A fight breaks out — ${n} foes close in!`)
            return battle
        }
        return null
    }

    // Pocket-dimension phasing. Sets `enemy.phased` on every enemy each tick:
    // true when the enemy is NOT a roster member but stands inside an active
    // arena, false otherwise. A phased enemy is hidden (World) and blind to the
    // fight (BaseEnemy.updatePerception) and passes straight through combatants
    // (Dungeon.stepEntityTo) — as if the arena were a separate dimension it's
    // walking across. Recomputed every tick so it phases the instant it crosses
    // the ring and snaps back to normal when it leaves or the battle ends.
    //
    // Called from World.update AFTER update(), so an enemy that just joined a
    // fight (eligible reinforcer, e.battle now set) is correctly un-phased and
    // doesn't flicker. Separate from update() because phasing must run every
    // tick regardless of update()'s form/join early-returns — an idle patrol
    // drifting through an arena is never in the "loose alerted" set.
    syncPhasing() {
        const active = this.battles.filter(b => b.active)
        const arenaActive = active.length > 0
        for (const e of tm.entities) {
            if (e.type !== 'enemy') continue
            if (e.battle) { e.phased = false; e.freeForAll = false; continue }
            // Inside an active arena it isn't part of → phased (invisible,
            // inert, pass-through), squad or not. This is what keeps a duel
            // a duel: nothing else in the ring touches the hero.
            e.phased = active.some(b => b.contains(e.x, e.y))
            // Squads engage free-for-all (pre-arena: fight on alert) ONLY when
            // no duel is active. While one is, they stand down so they can't
            // interfere — the airtight side of "groups ignore the arena".
            e.freeForAll = optsOutOfArena(e) && !arenaActive
        }
    }

    // True when the hero is standing on a stairs tile (up or down) — the exit
    // points. Used to suppress arena formation there so the intro-beat pause
    // can't collide with a floor transition.
    _onStairs(hero) {
        const s = mapState.stairs
        if (!s) return false
        return (s.down && hero.x === s.down.x && hero.y === s.down.y)
            || (s.up && hero.x === s.up.x && hero.y === s.up.y)
    }

    // Active battles the hero is standing inside — the fights they're party to.
    battlesWith(hero) {
        return this.battles.filter(b => b.active && b.contains(hero.x, hero.y))
    }

    // Open the hero's post-battle unnoticeable window (see POST_BATTLE_GRACE).
    // BaseEnemy.updatePerception reads hero.unnoticeableUntil and suppresses
    // alerting while the tick is inside it.
    _grantPostBattleGrace(hero) {
        if (hero) hero.unnoticeableUntil = tm.tickCount + POST_BATTLE_GRACE
    }

    // The hero breaks off a fight. The abandoned roster grows Emboldened
    // (re-engaging is harder), then the battle resolves 'fled'. Shared by the
    // deliberate Retreat and by walking out across the ring, so leaving a
    // fight is always consequential — you can't dodge the cost by strolling
    // out. See documents/v3_objective_driven_encounters.md (universal flee).
    _concede(battle) {
        let emboldenedAny = false
        for (const enemy of battle.roster) {
            if (!enemy.sprite) continue
            enemy.addTag(emboldened)
            // Grace window: the manager won't re-recruit these enemies for a
            // few rounds (see RETREAT_GRACE), so breaking off actually gives
            // the player room to get away instead of snapping straight back
            // into the same fight.
            enemy.disengageUntil = tm.tickCount + RETREAT_GRACE
            emboldenedAny = true
        }
        if (emboldenedAny) gameLog.log('The enemies grow emboldened!')
        this._recordOutcome(battle, 'fled')
        battle.end('fled', tm.tickCount)
    }

    // Snapshot a resolving battle's outcome + center for the closing banner
    // (World reads these when it emits 'combat-end'). Captured before/at end
    // because the battle leaves the active list immediately after.
    _recordOutcome(battle, outcome) {
        this.lastOutcome = outcome
        this.lastAnchorX = battle.anchorX
        this.lastAnchorY = battle.anchorY
    }

    // Deliberate Retreat (player input, the universal flee verb for the hero).
    // Rolls an SPD-scaled escape against every fight the hero is in. Success
    // concedes them all; failure leaves the fights running (the caller still
    // spends the action — the attempt IS the turn). Returns:
    //   'none'   — not in combat, nothing to retreat from (no cost)
    //   'failed' — roll missed, fights continue
    //   'fled'   — escaped, arenas dissolved, rosters Emboldened
    playerRetreat(hero) {
        const fights = this.battlesWith(hero)
        if (fights.length === 0) return 'none'
        const chance = Math.min(0.9, 0.45 + hero.stat('SPD') * 0.04)
        if (Math.random() > chance) return 'failed'
        for (const battle of fights) this._concede(battle)
        // A clean getaway earns the same dust-settles window as any other
        // fight ending, so the floor doesn't immediately re-notice the hero.
        if (!this.inCombat) this._grantPostBattleGrace(hero)
        return 'fled'
    }
}

export default new EncounterManager()
