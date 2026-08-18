import Prop from "./Prop.js"
import mapState from "../MapState.js"
import gameLog from "../GameLog.js"
import { spawnHealNumber, startCampEmotes } from "../Animations.js"

// Tent — the rest room's centerpiece and the player's safe camp. Built on the
// Prop primitive (placeable, blocks its tile, interactable from an adjacent
// tile like a shrine).
//
// Press F to MAKE CAMP: the player is fully healed and the tent's room becomes
// a safe zone — no enemy may enter while camp is up (enforced in
// Dungeon.stepEntityTo + WorldQueries.gridForEntity via room.restSafe). Press F
// again to BREAK CAMP; it also breaks automatically when the player leaves the
// room (room.onExit). The safe state lives on the Room, so it isn't persisted
// across floor revisits — the player simply re-camps, which is the intent.

// tileReference.json regions.worldBuildings.tentRed (980 — "Red small pointed
// building / tent"). One constant so it's easy to verify in test.html.
const TILE_TENT = 980

export default class Tent extends Prop {
    constructor(x, y) {
        super(x, y, TILE_TENT, {
            name: "Tent",
            description: "A bedroll under canvas. Press F to make camp.",
            type: "prop",
        })
        this.camped = false
        this._room = null
    }

    // Lazily resolve (and cache) the room this tent sits in. Rooms exist by the
    // time the player can interact, so a one-time lookup is enough.
    room() {
        if (!this._room) {
            this._room = mapState.rooms
                ? mapState.rooms.find(r => r.contains(this.x, this.y)) || null
                : null
        }
        return this._room
    }

    interactPrompt() {
        return this.camped ? "[F] Break camp" : "[F] Make camp"
    }

    onInteract(actor) {
        if (this.camped) {
            this.breakCamp()
            return
        }
        this.makeCamp(actor)
    }

    makeCamp(actor) {
        const room = this.room()
        if (room) {
            room.restSafe = true
            // End camp the moment the player steps out of the room, so the
            // safe zone never lingers behind them. Cleared in breakCamp.
            room.onExit = () => this.breakCamp()
        }

        const restored = actor.maxHealthPoints - actor.healthPoints
        actor.healthPoints = actor.maxHealthPoints
        if (restored > 0) spawnHealNumber(actor, restored)

        // Camp restores the whole party too — allies / followers rest alongside the
        // hero, so every living party member is healed to full.
        if (Array.isArray(actor.party)) {
            for (const ally of actor.party) {
                if (!ally || ally.healthPoints == null || ally.healthPoints <= 0) continue
                const allyRestored = ally.maxHealthPoints - ally.healthPoints
                ally.healthPoints = ally.maxHealthPoints
                if (allyRestored > 0) spawnHealNumber(ally, allyRestored)
            }
        }

        this.camped = true
        // Camp COMMITS the hero: they can't move until they break camp (F). The flag
        // lives on the hero so HeroController can gate movement; `_camper` lets
        // breakCamp() clear it regardless of how camp ends (F, room-exit, teardown).
        this._camper = actor
        actor.camped = true
        // The hero + their gathered party emote around the flame while camp is up.
        const restingParty = (actor.party || []).filter(a => a && a.healthPoints > 0)
        this._emotes = startCampEmotes([actor, ...restingParty])
        this.description = "Camp is set — no enemies can enter. Press F to break camp."
        gameLog.log(`${actor.name} makes camp and rests. Break camp [F] to move on.`)
    }

    breakCamp() {
        const room = this.room()
        if (room) {
            room.restSafe = false
            room.onExit = null
        }
        this.camped = false
        this._releaseCamper()
        this.description = "A bedroll under canvas. Press F to make camp."
        gameLog.log(`Camp is broken.`)
    }

    // End the camp side-effects: stop the emotes and lift the movement lock from
    // whoever was camped here. Called by every camp-ending path (F, room-exit, teardown).
    _releaseCamper() {
        if (this._emotes) {
            this._emotes.stop()
            this._emotes = null
        }
        if (this._camper) {
            this._camper.camped = false
            this._camper = null
        }
    }

    // Safety: if the tent is ever torn down mid-camp, drop the safe flag so the
    // room doesn't stay permanently enemy-proof — and free the camper's movement.
    onDestroy() {
        const room = this.room()
        if (room) {
            room.restSafe = false
            room.onExit = null
        }
        this._releaseCamper()
    }
}
