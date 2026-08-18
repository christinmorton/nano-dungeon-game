import Door from "./Door.js"
import gameLog from "../GameLog.js"

// TILE_HIDDEN reads as a distinct wall variant in-game (picked visually
// via test.html — json note says "white ladder, tall pattern" but the
// sprite reads as a noticeable wall feature). TILE_OPEN matches Door's
// open frame so revealed passages blend with normal corridors.
const TILE_HIDDEN = 246
const TILE_OPEN = 447

// A Door variant that starts in a "hidden" state: blocks movement,
// renders as a special wall variant, and is revealed by pressing E
// adjacent. Once revealed, behaves like a normal open door — the player
// can walk through, and the door state participates in FloorMemory the
// same way regular doors do.
export default class HiddenPassage extends Door {
    constructor(x, y) {
        super(x, y, false)
        this.state = "hidden"
        this.name = "Cracked Wall"
        this.description = "Something about this wall looks off."
        if (this.sprite) {
            this.sprite.setFrame(TILE_HIDDEN)
        }
    }

    reveal() {
        if (this.state !== "hidden") return
        this.state = "open"
        this.name = "Hidden Passage"
        this.description = "A hidden passage."
        if (this.sprite) this.sprite.setFrame(TILE_OPEN)
    }

    interactPrompt(actor) {
        if (this.state === "hidden") return "[E] Search the wall"
        return super.interactPrompt(actor)
    }

    onInteract(actor) {
        if (this.state === "hidden") {
            if (typeof actor.movementPoints === "number" && actor.movementPoints <= 0) {
                gameLog.log(`No movement left this turn.`)
                return
            }
            this.reveal()
            gameLog.log(`${actor.name} discovers a hidden passage!`)
            if (typeof actor.movementPoints === "number") actor.movementPoints -= 1
            return
        }
        return super.onInteract(actor)
    }
}
