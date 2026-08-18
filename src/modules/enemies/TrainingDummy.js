import dungeon from "../Dungeon.js"
import tm from "../TurnManager.js"
import gameLog from "../GameLog.js"
import BaseEnemy from "./BaseEnemy.js"

// TrainingDummy — the target for the A->Z ability bench (levels/TrainingLevel.js).
// Extends BaseEnemy so it's a fully valid combat target (HP, stat(), team, status
// handling, HP bar), but behaves like a practice pell:
//   - inert: never moves, attacks, perceives, or talks (turn() no-op, muted,
//     no vision cone).
//   - deathless: at 0 HP it does NOT die/despawn (the `deathless` flag makes
//     dungeon.removeEntity refuse it). Instead, after a few rounds without taking
//     damage, it snaps back to full HP — an automatic reset between test rounds.
//     Works from partial damage too, not just a full knockout. (Rounds only tick
//     as the player acts, so pass/move a few turns to let the reset fire.)
//   - no loot.
// team stays "monster" so the player's offensive abilities target it.

const DUMMY_HP = 100
const RESET_DELAY_ROUNDS = 2        // undamaged rounds to wait before snapping back to full

export default class TrainingDummy extends BaseEnemy {
    static tier = 1

    constructor(x, y) {
        super(x, y)
        this.name = "Training Dummy"
        this.movementPoints = 0
        this.actionPoints = 1
        this.speed = 1
        // 1 AP/round (no movement). The dummy takes a do-nothing turn each round
        // ONLY so its turn() is called — that's what fires status lifecycle hooks
        // (e.g. Burning's per-round damage tick, which the tag system wraps onto
        // turn()). Zeroing AP in turn() then lets over() complete the round.
        this.refreshRates = { movementPoints: 0, actionPoints: 1, healthPoints: 0 }

        // Max-first per the canonical-stat convention, then derive current.
        this.maxHealthPoints = DUMMY_HP
        this.healthPoints = this.maxHealthPoints
        this._idleRounds = 0                         // rounds since it last took damage
        this._lastHealth = this.maxHealthPoints      // HP at the end of the previous round

        // No death, no loot, no chatter, no perception.
        this.deathless = true
        this.noDrops = true
        this.mute = true
        this.detectionRadius = 0
        this.visionConeDegrees = 0

        this.x = x
        this.y = y
        this.type = "enemy"
        this.weapon.name = "—"

        // Prop art (data/tileReference.props.json) rather than a monster sprite.
        this.art = { sheet: "props", file: "training_dummy.png" }

        // initializeEntity builds the sprite; addEntity puts it in the turn /
        // collision / entityAtTile index — BOTH are needed.
        dungeon.initializeEntity(this)
        tm.addEntity(this)
    }

    // Pass the turn doing nothing. Being CALLED each round is the point: the tag
    // system wraps turn(), so this is where DoTs (Burning, Blight, Bleed…) land
    // their per-round tick. Zero AP so over() turns true and the round completes.
    turn() {
        this.actionPoints = 0
        this.movementPoints = 0
    }

    // refresh() runs on every entity each round (driven by tm.refresh() once a
    // round completes — which only happens as the player acts). super.refresh()
    // refills the 1 AP (so turn() fires again next round) + runs the wrapped
    // status refresh hooks. Then the reset cycle: any HP drop this round (a hit OR
    // a DoT tick) restarts the idle wait; after RESET_DELAY_ROUNDS undamaged
    // rounds it snaps back to full — reliable whether it was chipped or downed.
    refresh() {
        super.refresh()

        // Did it take damage since last round? (A ticking DoT counts, so it won't
        // heal mid-DoT.) Any drop restarts the wait; otherwise the idle count grows.
        if (this.healthPoints < this._lastHealth) {
            this._idleRounds = 0
        } else {
            this._idleRounds += 1
        }

        if (this.healthPoints < this.maxHealthPoints && this._idleRounds >= RESET_DELAY_ROUNDS) {
            this.healthPoints = this.maxHealthPoints
            this._idleRounds = 0
            gameLog.log(`${this.name} resets to full HP.`)
        }

        this._lastHealth = this.healthPoints
    }

    // No enemy vision cone — the dummy doesn't perceive. (BaseEnemy suppresses
    // the cone for team 'player'; the dummy is 'monster', so override directly.)
    syncPerceptionCircle() {
        if (this.perceptionCircle) this.perceptionCircle.clear()
    }

    // Console reset helper (window.training.resetDummy) — restore to full now.
    resetHealth() {
        this.healthPoints = this.maxHealthPoints
        this._idleRounds = 0
        this._lastHealth = this.maxHealthPoints
    }
}
