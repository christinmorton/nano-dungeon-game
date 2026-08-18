import GenericItem from "./GenericItem.js"

const KEY_TILE = 571

export default class DungeonKey extends GenericItem {
    constructor(x, y) {
        super(x, y, KEY_TILE, null, { sheet: "32rogues-items", name: "goldKey" })
        this.name = "Dungeon Key"
        this.description = "Opens a locked door. Consumed on use."
        this.isKey = true
        this.tallyKey = "keys"
        // No random tag variants until door/lock variants exist —
        // burning/golden/etc. keys would imply mechanics we don't have.
        this.tagPolicy = { materials: false, effects: false }
    }
}
