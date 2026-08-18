import GenericItem from "./GenericItem.js"
import tm from "../TurnManager.js"
import gameLog from "../GameLog.js"
import { doorCreaks } from "../dialog/environmentBarks.js"

const TILE_CLOSED = 497
const TILE_OPEN = 447
const TILE_LOCKED = 500
const SEAL_TINT = 0xff6633

export default class Door extends GenericItem {
    constructor(x, y, locked = false) {
        super(x, y, locked ? TILE_LOCKED : TILE_CLOSED)
        this.type = "door"
        this.state = locked ? "locked" : "closed"
        this.name = locked ? "Locked Door" : "Door"
        this.description = locked
            ? "It is locked. You will need a Dungeon Key."
            : "A closed door."
        // Per-instance frames so subclasses (FortressGate) can re-skin the
        // door with their own art while reusing the open/close/unlock/seal
        // machinery. Defaults preserve the vanilla door look.
        this.frameClosed = TILE_CLOSED
        this.frameOpen = TILE_OPEN
        this.frameLocked = TILE_LOCKED
        // Solid doors block line-of-sight when shut. Subclasses that read as
        // see-through (a barred gate) set this true so LOS passes the bars.
        this.seeThrough = false
    }

    unlock() {
        this.state = "closed"
        this.name = "Door"
        this.description = "A closed door."
        if (this.sprite) {
            this.sprite.setFrame(this.frameClosed)
            this.sprite.clearTint()
        }
    }

    open() {
        if (this.state !== "closed") return
        this.state = "open"
        this.description = "An open door."
        if (this.sprite) {
            this.sprite.setFrame(this.frameOpen)
        }
    }

    close() {
        if (this.state !== "open") return
        this.state = "closed"
        this.description = "A closed door."
        if (this.sprite) {
            this.sprite.setFrame(this.frameClosed)
        }
    }

    // Sealed doors block until a condition is met (e.g. a duelist elite
    // dies). They look like locked doors with an orange tint, but unlike
    // locked doors they don't consume a key — only unseal() can release.
    seal() {
        if (this.state === "sealed") return
        if (this.state === "open") this.close()
        this.state = "sealed"
        this.name = "Sealed Door"
        this.description = "Magic seals this door shut."
        if (this.sprite) {
            this.sprite.setFrame(this.frameLocked)
            this.sprite.setTint(SEAL_TINT)
        }
    }

    unseal() {
        if (this.state !== "sealed") return
        this.state = "closed"
        this.name = "Door"
        this.description = "A closed door."
        if (this.sprite) {
            this.sprite.setFrame(this.frameClosed)
            this.sprite.clearTint()
        }
    }

    interactPrompt(actor) {
        if (this.state === "open") return "[E] Close door"
        return null
    }

    onInteract(actor) {
        if (this.state !== "open") return

        if (typeof actor.movementPoints === "number" && actor.movementPoints <= 0) {
            gameLog.log(`No movement left this turn.`)
            return
        }

        for (const e of tm.entities) {
            if (e === this) continue
            // Passive entities (loot bags, chests) don't block a door close.
            // The container stays "under" the closed door and becomes
            // accessible again the next time the door is reopened.
            if (e.type === "container") continue
            if (e.x === this.x && e.y === this.y) {
                gameLog.log(`Something is in the way.`)
                return
            }
        }

        this.close()
        gameLog.log(`${actor.name} closes the door.`)
        doorCreaks(this)
        if (typeof actor.movementPoints === "number") actor.movementPoints -= 1
    }

    onDestroy() {}
}
