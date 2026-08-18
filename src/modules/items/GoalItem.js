import GenericItem from "./GenericItem.js"
import run from "../Run.js"

// GoalItem — the generalized win-condition collectible (design §15.8). A
// walk-into item that ends the run on pickup, exactly like the Amulet, but with
// a designer-chosen name + sprite. The sprite comes from an Atlas asset picked
// in the designer (art = { sheet, frame }) and renders via the entity.art path
// (assetLoader / Dungeon render) when its sheet is preloaded; it falls back to
// the Amulet tile if the sheet isn't loaded.
//
// The roster-source goal reuses a real makeItem(key) with its onPickup swapped
// for the win (see Quest.js) — this class is specifically for the Atlas source.
export default class GoalItem extends GenericItem {
    constructor(x, y, { name, art } = {}) {
        super(x, y, 437, null, art || null)   // 437 = Amulet frame (art-absent fallback)
        this.name = name || "Relic"
        this.description = "The goal of this dungeon."
        this.actionPoints = 1
    }

    turn() { this.actionPoints = 0 }
    onPickup() { run.endRun("win") }
    refresh() { this.actionPoints = 1 }
    over() { return this.actionPoints == 0 }
}
