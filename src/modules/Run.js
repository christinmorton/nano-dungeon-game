import dungeon from './Dungeon.js'
import mapState from './MapState.js'
import router from './SceneRouter.js'
import floorMemory from './FloorMemory.js'
import gameLog from './GameLog.js'
import tm from './TurnManager.js'
import { makeInFlightCharacter, buildRunRecord, commitWin, commitDeath } from './heroCommit.js'
// (heroCommit.js + character.js are pure modules — no ability registry, no Phaser —
// so they are safe to import here despite the registry rule below.)
// NOTE: do NOT statically import the ability registry (or draft.js, which pulls it)
// here. Run.js is imported by BaseEnemy during BaseEnemy's own init, and the
// registry eagerly globs every ability — including Follower, which extends
// BaseEnemy — so a static import would re-enter a half-built BaseEnemy (TDZ crash).
// The draft is rolled in World.create (outside that chain) when draftPending is set.

// Skill-point accrual tuning (§14 B7 / §6.2). Points fuel the upgrade screen.
//   - A guaranteed MILESTONE lump-sum each time you reach a new deepest floor
//     (also granted once for floor 1 at run start).
//   - A run-score trickle per kill.
const MILESTONE_SKILL_POINTS = 3
const KILL_SKILL_POINTS = 1
// Affinity shards — the affinity-system-only currency (§ upgrade tree). Earned by a
// MIX: mastery-through-use (damage dealt while attuned) + a per-kill bonus.
const KILL_AFFINITY_SHARDS = 1
const MASTERY_DAMAGE_PER_SHARD = 40

// Run-level state and lifecycle. Owns:
//   - stats: per-run accumulators (kills, items, deepest floor, turns)
//   - transitioning: floor-fade gate that prevents input + double-trigger
//     while the camera fade is in flight
//   - goDown / goUp: floor transitions (camera fade -> dungeon advance ->
//     dungeon-changed event)
//   - endRun: routes to the EndScreen via SceneRouter
//   - computeScore: derives the run score from stats
//
// Lifecycle:
//   - Dungeon.initialize calls run.start() once per fresh game (when
//     dungeon.initialized flips true) to seed stats.
//   - Dungeon.initialize resets run.transitioning = false on every floor
//     entry — the fade gate must clear when the new World scene is up.
//
// Run reaches into the dungeon singleton for scene access and per-floor
// cleanup, and into mapState for the level-sequence advance.

class Run {
    constructor() {
        this.transitioning = false
        this.stats = null
        // One free revive per run — consumed by the DeathScreen's Revive choice.
        this.reviveUsed = false
        // "down" | "up" | "portal" | null — set by goDown/goUp/goToFloor, read by
        // World on re-entry to spawn the player at the stairs they arrived through
        // (rather than always at the leftmost room).
        this.lastTransition = null
        // Explicit arrival tile/room for a cross-floor portal jump (§15.9 slice
        // 2b). { room:areaId } | { tile:{x,y} } | null — consumed by
        // Dungeon.placePlayer, which resolves it on the destination floor.
        this.pendingArrival = null
        // The in-flight HERO this run is played as (hero-roster rebuild, doc §4).
        // Set by beginCharacter(); null until then. `seed` is the run's level seed
        // stamped onto each RunRecord. Both are inert in the live flow this phase —
        // the commit machinery below is headless (not yet wired to run-start/EndScreen).
        this.character = null
        this.seed = null
        // Play-time tracking (see start() for the full note). Initialised here too
        // so the fields are always numbers even if start() hasn't run (arena bench).
        this.floorRecords = []
        this.runSeconds = 0
        this._floorSeconds = 0
        this._floorRoundBase = 0
    }

    start() {
        this.stats = {
            kills: 0,
            itemsFound: 0,
            deepestFloor: 1,
            turns: 0
        }
        this.transitioning = false
        this.lastTransition = null
        this.pendingArrival = null
        this.character = null
        this.seed = null
        this.reviveUsed = false
        // Skillbook persistence buffer (§14 B3): registry keys of abilities/traits
        // LEARNED during this run (tomes, drops, future drafts). Committed to the
        // account only on extraction (a win); a death drops them. Class starting-kit
        // abilities are NOT recorded here — only acquired ones bank.
        this.learnedAbilities = []
        this.learnedTraits = []
        // Skill points available to spend in the upgrade screen (§14 B7). Run-scoped
        // — they accrue and are spent within a run; nothing here persists to the
        // account. Seed with the floor-1 milestone so the screen is usable from turn 1.
        this.skillPoints = MILESTONE_SKILL_POINTS
        // Affinity shards — the affinity-only currency spent in the Skillbook Affinity
        // tab to grow the attuned basic affinity (empower tier, reroll passive). Run-
        // scoped. Accrue quietly (shown in the tab): mastery-through-use funnels damage
        // dealt while attuned into `_masteryProgress`, converted to shards at a threshold.
        this.affinityShards = 0
        this._masteryProgress = 0
        // Milestone draft (§14 B5/B6). draftPending is set on reaching a new deepest
        // floor; World.create rolls the offer (rollDraft) and stashes it in
        // pendingDraft, then opens DraftScreen. Split this way so Run.js never has to
        // import the ability registry (see the import note above).
        this.draftPending = false
        this.pendingDraft = null
        // Affinity passive draft (§18 rare "Pure" essence): staged by Consumable._attune
        // with { affinity, options }, opened/consumed by the shared DraftScreen.
        this.pendingPassiveDraft = null

        // --- Play-time tracking (run-time budgeting instrument) --------------------
        // Real elapsed time is accumulated in World.update, which does NOT run while a
        // modal overlay pauses the World scene — so time spent in menus is naturally
        // excluded ("real time, paused in menus"). Rounds come from tm.tickCount: the
        // engine advances one round when every actor (incl. the hero's full AP/MP
        // action phase) has resolved, so in this engine a "turn" and a "round" are the
        // same tick. A finer per-action "turns" metric can layer on later if the AP/MP
        // model changes. Records are committed per floor on descent; runSeconds is the
        // authoritative run total. See documents/v3_dungeon_archetype_system.md.
        this.floorRecords = []      // [{ floor, seconds, rounds }]
        this.runSeconds = 0         // total real play-time across the run (menu-paused)
        this._floorSeconds = 0      // current floor's accrued real time
        this._floorRoundBase = tm.tickCount   // round baseline snapshot at floor entry

        floorMemory.clear()
    }

    // --- Play-time tracking -------------------------------------------------------
    // Called on every floor ENTRY (Dungeon.initialize) — resets the floor timer and
    // snapshots the round baseline for per-floor round deltas.
    beginFloor() {
        this._floorSeconds = 0
        this._floorRoundBase = tm.tickCount
    }

    // Accrue real elapsed seconds for the current floor + run total. Driven by
    // World.update, which is skipped while a modal pauses the World scene.
    tickFloorTime(dtSeconds) {
        if (!(dtSeconds > 0)) return
        this._floorSeconds += dtSeconds
        this.runSeconds += dtSeconds
    }

    floorSeconds() { return this._floorSeconds || 0 }
    floorRounds() { return tm.tickCount - (this._floorRoundBase || 0) }

    // Commit the finishing floor's record on descent (called from goDown before the
    // level index advances, so currentLevel still points at the floor being left).
    commitFloorRecord() {
        const floor = mapState.levelManager.currentLevel + 1
        if (this.floorRecords.some(r => r.floor === floor)) return
        this.floorRecords.push({
            floor,
            seconds: Math.round(this._floorSeconds || 0),
            rounds: this.floorRounds(),
        })
    }

    // Per-floor + total play-time for the end-of-run summary. Includes the
    // in-progress floor (not yet committed via descent) so the final floor counts.
    timeSummary() {
        const records = [...(this.floorRecords || [])]
        const floor = mapState.levelManager
            ? mapState.levelManager.currentLevel + 1
            : records.length + 1
        if ((this._floorSeconds || 0) > 0 && !records.some(r => r.floor === floor)) {
            records.push({
                floor,
                seconds: Math.round(this._floorSeconds),
                rounds: this.floorRounds(),
                inProgress: true,
            })
        }
        return {
            records,
            totalSeconds: Math.round(this.runSeconds || 0),
            totalRounds: records.reduce((s, r) => s + (r.rounds || 0), 0),
        }
    }

    // Grant skill points (§14 B7). Logs so the player knows to spend them.
    awardSkillPoints(n, reason) {
        if (!n) return
        this.skillPoints = (this.skillPoints || 0) + n
        const why = reason ? ` (${reason})` : ""
        gameLog.log(`+${n} skill point${n === 1 ? "" : "s"}${why}. Press K to spend.`)
    }

    // Per-kill skill-point reward (§14 B7) — keeps the KILL tuning constant here.
    // Also drops a per-kill affinity shard (the "essence from defeated foes" source).
    rewardKill() {
        this.awardSkillPoints(KILL_SKILL_POINTS, "kill")
        this.awardAffinityShards(KILL_AFFINITY_SHARDS)
    }

    // Spend points if affordable; returns true on success. The upgrade screen
    // gates each purchase through here so the pool can't go negative.
    spendSkillPoints(n) {
        if ((this.skillPoints || 0) < n) return false
        this.skillPoints -= n
        return true
    }

    // --- Affinity shards (§ upgrade tree) ---------------------------------------
    // Grant shards (quietly — the balance shows in the Skillbook Affinity tab).
    awardAffinityShards(n) {
        if (!n) return
        this.affinityShards = (this.affinityShards || 0) + n
    }

    // Mastery-through-use: funnel damage the hero deals WHILE ATTUNED into shards at a
    // fixed threshold. Called from BaseHero.onDealtDamage.
    awardAffinityMastery(dmg) {
        if (!(dmg > 0)) return
        this._masteryProgress = (this._masteryProgress || 0) + dmg
        while (this._masteryProgress >= MASTERY_DAMAGE_PER_SHARD) {
            this._masteryProgress -= MASTERY_DAMAGE_PER_SHARD
            this.awardAffinityShards(1)
        }
    }

    // Spend shards if affordable; returns true on success (gates each tree purchase).
    spendAffinityShards(n) {
        if ((this.affinityShards || 0) < n) return false
        this.affinityShards -= n
        return true
    }

    // Record an ability key the hero learned this run (called by
    // BaseHero.learnAbility). Deduped; the buffer survives floor transitions and
    // is read by the end screen's extraction commit.
    recordLearnedAbility(key) {
        if (!key) return
        if (!this.learnedAbilities) this.learnedAbilities = []
        if (!this.learnedAbilities.includes(key)) this.learnedAbilities.push(key)
    }

    // --- Hero-roster commit machinery (rebuild phase 2; doc §4) ------------------
    // HEADLESS MACHINERY: these methods are self-contained + tested but are NOT yet
    // called by the live run-start / EndScreen flow. They wire in during the Guild
    // Hall UI phase (doc §13 phase 6), once hero SELECTION exists. `account` is
    // PASSED IN (not imported) so Run.js stays decoupled and the methods stay pure
    // enough to test headlessly. The current flat-account book (commitLearned /
    // applyAccountBook) is untouched, so ability-drawing into runs never regresses.

    // Establish the in-flight hero for this run: CONTINUE a stored roster hero
    // (`spec.continue` = a Character) or MINT a fresh one from a class
    // (`spec.heroClass`/`name`/`motivation`/`lore`). Sets this.character (the run's
    // working copy); roster lookups later key off its stable id.
    beginCharacter(spec = {}) {
        this.character = makeInFlightCharacter(spec)
        return this.character
    }

    // Assemble a RunRecord (data on the hero, doc §3.3) from the current run state.
    // `extra` supplies what the run state can't self-derive (seed, killedBy).
    buildRunRecord(outcome, extra = {}) {
        const time = typeof this.timeSummary === "function" ? this.timeSummary() : null
        return buildRunRecord({ stats: this.stats, time, seed: this.seed }, outcome, extra)
    }

    // Extraction commit on a WIN (doc §4.1): merge the run's learned kit onto the
    // in-flight hero + append a win RunRecord, then UPDATE it on the roster (a
    // continued hero) or ADD it (a newly-saved hero, slot permitting). Returns the
    // committed character, or null (no in-flight hero / roster full on a new save).
    commitOnWin(account, extra = {}) {
        return commitWin(
            account,
            this.character,
            { learnedAbilities: this.learnedAbilities, learnedTraits: this.learnedTraits },
            this.buildRunRecord("win", extra),
        )
    }

    // Permadeath commit on a DEATH (doc §4.2): a continued roster hero is moved to
    // the Fallen wall with a death record — its run gains are DROPPED, so the
    // STORED/pristine copy falls, not the in-flight one. A fresh never-saved hero
    // vanishes (nothing on the roster to move). Returns the fallen character, or null.
    commitOnDeath(account, extra = {}) {
        return commitDeath(account, this.character, this.buildRunRecord("death", extra))
    }

    goDown() {
        if (this.transitioning) return
        this.transitioning = true

        dungeon.scene.cameras.main.once('camerafadeoutcomplete', () => {
            floorMemory.save(mapState.levelManager.currentLevel, floorMemory.snapshot())
            dungeon.cleanup()
            // Record the finishing floor's play-time BEFORE the level index advances
            // (currentLevel still points at the floor being left). tm.tickCount is
            // untouched by cleanup, so the round delta stays valid.
            this.commitFloorRecord()
            mapState.levelManager.goDown()
            this.lastTransition = "down"
            const newFloor = mapState.levelManager.currentLevel + 1
            if (this.stats && newFloor > this.stats.deepestFloor) {
                this.stats.deepestFloor = newFloor
                // New deepest floor = the guaranteed milestone lump-sum (§14 B7).
                this.awardSkillPoints(MILESTONE_SKILL_POINTS, `floor ${newFloor}`)
                // ...and flag the milestone ability draft (§14 B5/B6). Keyed to
                // deepest depth (this block only runs on a NEW deepest floor) = no
                // re-farm on backtrack. World.create rolls + opens the offer.
                if (typeof window === "undefined" || !window.ARENA_MODE) {
                    this.draftPending = true
                }
            }
            dungeon.scene.events.emit('dungeon-changed')
        }, this)
        dungeon.scene.cameras.main.fadeOut(1000, 0, 0, 0)
    }

    goUp() {
        if (this.transitioning) return
        this.transitioning = true

        dungeon.scene.cameras.main.once('camerafadeoutcomplete', () => {
            floorMemory.save(mapState.levelManager.currentLevel, floorMemory.snapshot())
            dungeon.cleanup()
            mapState.levelManager.goUp()
            this.lastTransition = "up"
            dungeon.scene.events.emit('dungeon-changed')
        }, this)
        dungeon.scene.cameras.main.fadeOut(1000, 0, 0, 0)
    }

    // Cross-floor portal jump (§15.9 slice 2b): descend/ascend to an ARBITRARY
    // floor and land at an authored arrival (a room or tile on the destination
    // floor), vs stairs' ±1 + auto anchor. `arrival` = { room:areaId } | { tile }.
    // Mirrors goDown/goUp; the deeper-floor milestone (skill points + draft) fires
    // only on a NEW deepest floor, same as goDown, so a portal can't be farmed.
    goToFloor(targetIndex, arrival = null) {
        if (this.transitioning) return
        const lm = mapState.levelManager
        targetIndex = Math.max(0, Math.min(targetIndex | 0, lm.levels.length - 1))
        // Degenerate case (a portal whose dest resolves to the current floor, e.g.
        // a hand-edited import): just relocate on this floor, no fade/rebuild.
        if (targetIndex === lm.currentLevel) {
            const tile = mapState.arrivalTileFor(arrival)
            if (tile && dungeon.player) dungeon.moveEntityTo(dungeon.player, tile.x, tile.y)
            return
        }
        this.transitioning = true
        dungeon.scene.cameras.main.once('camerafadeoutcomplete', () => {
            floorMemory.save(lm.currentLevel, floorMemory.snapshot())
            dungeon.cleanup()
            // Commit the finishing floor's play-time before the index moves, and
            // only when going deeper (ascending revisits don't close a record).
            if (targetIndex > lm.currentLevel) this.commitFloorRecord()
            lm.goTo(targetIndex)
            this.lastTransition = "portal"
            this.pendingArrival = arrival
            // A portal is a SHORTCUT, not earned progression: it deliberately does
            // NOT grant the new-deepest-floor milestone (skill point + ability
            // draft) and does NOT advance deepestFloor. So jumping ahead (e.g. to
            // the last floor) can't hand out a free ability, and if the player
            // later descends those floors the legitimate way they still earn the
            // rewards. The milestone stays exclusive to stair descent (goDown).
            // (Per user 2026-07-12: a portal to the last / a lower / an already-
            // explored floor must not offer an ability.)
            dungeon.scene.events.emit('dungeon-changed')
        }, this)
        dungeon.scene.cameras.main.fadeOut(1000, 0, 0, 0)
    }

    endRun(outcome) {
        floorMemory.clear()
        router.bind(dungeon.scene)
        router.endRun(outcome)
    }

    // Called when the hero dies — opens the modal DeathScreen (revival window)
    // instead of cutting straight to the game-over screen. The DeathScreen
    // routes onward: End Run -> endRun('loss'), Restart -> a fresh game.
    heroDied() {
        router.bind(dungeon.scene)
        router.showDeath()
    }

    canRevive() {
        return !this.reviveUsed
    }

    // Consume the one-per-run revive: rebuild the hero in the world and resume
    // play. Called by the DeathScreen's Revive choice (after it stops itself).
    revive() {
        if (this.reviveUsed) return false
        this.reviveUsed = true
        dungeon.revivePlayer()
        router.bind(dungeon.scene)
        router.resumeFromDeath()
        return true
    }

    computeScore() {
        const r = this.stats || {}
        return Math.max(0,
            (r.deepestFloor || 1) * 100 +
            (r.kills || 0) * 10 +
            (r.itemsFound || 0) * 5 -
            Math.floor((r.turns || 0) / 10)
        )
    }
}

export default new Run()
