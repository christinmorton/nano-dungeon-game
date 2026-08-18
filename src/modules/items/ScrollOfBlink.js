import GenericItem from "./GenericItem.js"
import dungeon from "../Dungeon.js"
import gameLog from "../GameLog.js"

export default class ScrollOfBlink extends GenericItem {
    constructor(x, y) {
        super(x, y, 767, 0xff44dd)
        this.name = "A Scroll of Blink"
        this.description = "Read to teleport to a tile of your choice. Click a destination after reading."
    }

    equip(itemNumber, player) {
        player.controller.targeting = { type: "teleport", itemNumber }
        // Drop the toggle's "active" state — we drive removal via the click,
        // not via the equip toggle, so re-pressing the digit re-enters
        // targeting cleanly instead of needing two toggles.
        this.active = false
        gameLog.log(`Click a tile to teleport. Press Escape to cancel.`)
    }
}
