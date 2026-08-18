import Door from "./Door.js"
import dungeon from "../Dungeon.js"
import gameLog from "../GameLog.js"

// A Portal is an authored CONNECTION made concrete (design §15.9): step onto an
// active portal and it moves you to its destination. Two flavors:
//   - SAME-FLOOR (slice 2a): `dest` is a resolved { x, y } tile on this floor;
//     use() relocates ANY actor (hero + enemies) — a plain move.
//   - CROSS-FLOOR (slice 2b): `dest` is { floor:idx, room?, tile? }; this is a
//     HERO-ONLY floor jump (floors are the player's run context), handled in
//     HeroController via run.goToFloor — the destination is resolved on arrival.
//     `heroOnly` marks these so enemies never trigger them (Dungeon.stepEntityTo
//     + WorldQueries.gridForEntity keep enemies off cross-floor portals).
//
// Entrance style is HIDDEN by default (the Layer-3 "secret" theme): the portal
// starts sealed and reads as a wall until the player searches it with [E],
// exactly like HiddenPassage. A visible portal (hidden:false) starts active.
// Reveal machinery mirrors HiddenPassage so the two behave identically to search.
//
// It carries type "portal" so HeroController routes bumps to its own branch
// (not the door open/close path).

// TILE_HIDDEN matches HiddenPassage's concealed wall frame (verified there).
// TILE_ACTIVE reuses the revealed-passage frame with a tint so an open portal
// reads as "special" without a new verified frame — flagged for a test.html
// tile pick as later polish (verify-tiles-visually rule).
const TILE_HIDDEN = 246
const TILE_ACTIVE = 447
const PORTAL_TINT = 0xb06bff

export default class Portal extends Door {
    constructor(x, y, { dest = null, hidden = true } = {}) {
        super(x, y, false)
        this.type = "portal"
        this.dest = dest            // same-floor {x,y} | cross-floor {floor,room,tile}
        // A cross-floor dest (a floor index) makes this a hero-only floor jump.
        this.heroOnly = !!(dest && dest.floor != null && dest.floor !== "same")
        this.seeThrough = false

        if (hidden) {
            this.state = "hidden"
            this.name = "Cracked Wall"
            this.description = "Something about this wall looks off."
            if (this.sprite) this.sprite.setFrame(TILE_HIDDEN)
        } else {
            this._activate()
        }
    }

    _activate() {
        this.state = "active"
        this.name = "Portal"
        this.description = "A shimmering portal. Step in to travel."
        if (this.sprite) {
            this.sprite.setFrame(TILE_ACTIVE)
            this.sprite.setTint(PORTAL_TINT)
        }
    }

    // Search-to-reveal, identical in feel to HiddenPassage: an adjacent [E]
    // turns a concealed portal active. Costs a movement point.
    reveal() {
        if (this.state !== "hidden") return
        this._activate()
    }

    interactPrompt(actor) {
        if (this.state === "hidden") return "[E] Search the wall"
        return null
    }

    onInteract(actor) {
        if (this.state === "hidden") {
            if (typeof actor.movementPoints === "number" && actor.movementPoints <= 0) {
                gameLog.log(`No movement left this turn.`)
                return
            }
            this.reveal()
            gameLog.log(`${actor.name} discovers a hidden portal!`)
            if (typeof actor.movementPoints === "number") actor.movementPoints -= 1
            return
        }
        // An active portal is used by stepping into it (the bump path), mirroring
        // stairs — nothing to do on [E].
    }

    // SAME-FLOOR relocate — entity-agnostic (hero + enemies), called by the hero
    // bump branch (HeroController) and the enemy/NPC step branch
    // (Dungeon.stepEntityTo). No LevelManager / FloorMemory touch. CROSS-FLOOR
    // jumps never come through here (guarded by heroOnly) — HeroController drives
    // those via run.goToFloor. Player-facing feedback (camera flash + log) is
    // gated to the hero so a wandering enemy teleporting off-screen stays quiet.
    use(actor) {
        if (this.state !== "active" || this.heroOnly || !this.dest) return
        dungeon.moveEntityTo(actor, this.dest.x, this.dest.y)
        if (actor.type === "hero") {
            const cam = dungeon.scene && dungeon.scene.cameras && dungeon.scene.cameras.main
            if (cam) cam.flash(200, 120, 60, 180)
            gameLog.log(`${actor.name} steps through the portal.`)
        }
    }
}
