import dungeon from "../Dungeon.js"
import tm from "../TurnManager.js"
import gameLog from "../GameLog.js"
import BaseEnemy from "./BaseEnemy.js"
import { findAlliesInRange } from "../archetypes/captain.js"
import farsight from "../tags/farsight.js"
import elite from "../tags/elite.js"
import summoner from "../tags/summoner.js"
import formation from "../tags/formation.js"
import freeform from "../tags/freeform.js"

const DEATH_OUTCOMES = ["morale-break", "enrage", "last-orders"]

// Variant rolls — null slots produce vanilla captains so the spec's
// "average captain" sits alongside the variants. Tags get applied
// directly from this class (matching the eliteEnrager pattern) so the
// summoner import chain doesn't cycle through Taggable / Tags.
const VARIANT_TEMPLATES = {
    farsight,
    elite,
    summoner
}
// Variant rolling temporarily disabled. Summoner spawns goblins on a
// per-turn cadence (cooldown 6, but turns happen on the wall-clock
// throttle so the rate feels constant), and there's no per-ability
// cooldown system yet to gate it properly. Re-enable by restoring
// names in this array once abilities / skills land.
const VARIANT_ROLL = [null, null, null, null, null]

// Playbook roll — every captain has exactly one playbook (orchestration
// style). Blitz is the default (no tag needed); formation and freeform
// are applied as tags that override captain.playbook on initialize.
const PLAYBOOK_TEMPLATES = {
    formation,
    freeform
}
const PLAYBOOK_ROLL = ["blitz", "formation", "freeform"]

export default class Captain extends BaseEnemy {
    static tier = 3
    static archetype = "captain"

    constructor(x, y) {
        super(x, y)
        this.name = "Captain"
        this.movementPoints = 1
        this.actionPoints = 0
        this.refreshRates = {
            movementPoints: 1,
            actionPoints: 0,
            healthPoints: 0
        }

        // Soldier sprite (tile 222) picked from the tilesheet as a
        // humanoid-leader read. Not visually verified yet; swap to a
        // different tile via TestScreen if it doesn't read as a captain.
        this.tile = 222
        this.weapon.name = "sword"

        // Wider perception than baseline — captains scan the room.
        this.detectionRadius = 6

        // Order machinery (read by archetypes/captain.js).
        this.commandRadius = 5
        this.commandCooldownRemaining = 0
        this.commandsPerTick = 1
        this.lastCommand = null

        // Playbook — orchestration strategy. The captain archetype's
        // dispatcher picks the command vocabulary from this. "blitz" is
        // the default and matches the original behavior; "formation"
        // and "freeform" land in L3 as separate tags that override
        // this field on initialize.
        this.playbook = "blitz"
        this.playbookState = {}

        // Claim state + current activity — the out-of-combat layer.
        // The activity dispatcher in archetypes/captain.js routes on
        // this.activity whenever the captain is not engaged with the
        // player; the playbook layer takes over once engagement starts.
        // Recipes / generators may overwrite either field at spawn.
        // claimRegion is null until the claiming activity finalizes;
        // claimMarker is the Phaser rectangle drawn over the claimed
        // tiles, cleaned up in onDestroy below.
        // See documents/v3_enemy_squad_design.md for the full spec.
        this.claimState = "unclaimed"
        this.activity = "idle"
        this.activityState = {}
        this.claimRegion = null
        this.claimMarker = null
        // Reference to the Room the captain spawned in. Set by
        // RecipeApplier; null if the captain was spawned outside any
        // room (shouldn't happen in normal play). Activities use this
        // to keep scout/patrol/claim targets bounded to the room so
        // they don't try to path through closed doors into other
        // rooms — gridForEntity stamps closed doors as walls, so
        // cross-room targets just freeze the dispatched member.
        this.homeRoom = null

        // Death outcome is rolled at spawn. Player can't predict whether
        // killing the captain helps (morale-break, allies flee) or hurts
        // (enrage, allies pursue with renewed aggression; last-orders,
        // a persistent command outlives the captain by a few turns).
        this.deathOutcome = DEATH_OUTCOMES[Math.floor(Math.random() * DEATH_OUTCOMES.length)]

        dungeon.initializeEntity(this)

        // Playbook tag applies first so name prefixes read as
        // "Variant Playbook Captain" (e.g. "Elite Formation Captain").
        // blitz needs no tag — it's the default field value.
        const playbook = PLAYBOOK_ROLL[Math.floor(Math.random() * PLAYBOOK_ROLL.length)]
        if (playbook !== "blitz" && PLAYBOOK_TEMPLATES[playbook]) {
            this.addTag(PLAYBOOK_TEMPLATES[playbook])
        }

        const variant = VARIANT_ROLL[Math.floor(Math.random() * VARIANT_ROLL.length)]
        if (variant && VARIANT_TEMPLATES[variant]) {
            this.addTag(VARIANT_TEMPLATES[variant])
        }
    }

    onSpriteCreated() {
        super.onSpriteCreated()
        // Gold star marker above the head — Captains are easy to pick out
        // of a cluster at a glance. The text object scales with the
        // world camera (zoom 2x), so 10px renders 20px on screen.
        const scene = this.sprite.scene
        this._captainMarkerOffsetX = 8
        this._captainMarkerOffsetY = -5
        this.captainMarker = scene.add.text(
            this.sprite.x + this._captainMarkerOffsetX,
            this.sprite.y + this._captainMarkerOffsetY,
            "★",
            { font: "10px Arial", color: "#facc15" }
        ).setOrigin(0.5, 1).setDepth(52)
    }

    syncCaptainMarker(visibleByFog) {
        if (!this.sprite || !this.captainMarker) return
        this.captainMarker.visible = visibleByFog
        if (!this.captainMarker.visible) return
        this.captainMarker.x = this.sprite.x + this._captainMarkerOffsetX
        this.captainMarker.y = this.sprite.y + this._captainMarkerOffsetY
    }

    onDestroy() {
        if (this.captainMarker) this.captainMarker.destroy()
        if (this.claimMarker) this.claimMarker.destroy()
        super.onDestroy()
        // A void captain that SACRIFICED itself to channel a new rift wasn't
        // slain by the player — skip the morale-break/enrage/last-orders reaction.
        if (!this._sacrificed) this._applyDeathOutcome()
    }

    _applyDeathOutcome() {
        const allies = findAlliesInRange(this, this.commandRadius)
        if (allies.length === 0) return

        const issueTurn = tm.tickCount

        if (this.deathOutcome === "morale-break") {
            const availableAt = issueTurn + 1
            const expireAt = availableAt + 2
            for (const ally of allies) {
                ally.currentOrder = {
                    command: "fall-back",
                    source: "morale-break",
                    availableAt,
                    expireAt,
                    persistent: false
                }
            }
            gameLog.log(`The ${this.name} has fallen! Allies flee in panic.`)
            return
        }

        if (this.deathOutcome === "enrage") {
            const availableAt = issueTurn + 1
            const expireAt = availableAt + 3
            for (const ally of allies) {
                ally.state = "engaging"
                ally.currentOrder = {
                    command: "advance",
                    source: "enrage",
                    availableAt,
                    expireAt,
                    persistent: false
                }
            }
            gameLog.log(`The ${this.name} has fallen! Allies enrage!`)
            return
        }

        if (this.deathOutcome === "last-orders") {
            // Extend any persistent commands this captain left behind by
            // 3 turns. Converts them to time-bounded so they actually
            // expire instead of running forever.
            for (const ally of allies) {
                const order = ally.currentOrder
                if (order && order.persistent && order.source === this) {
                    order.expireAt = issueTurn + 4
                    order.persistent = false
                }
            }
            gameLog.log(`The ${this.name} has fallen! Their last orders persist.`)
            return
        }
    }
}
