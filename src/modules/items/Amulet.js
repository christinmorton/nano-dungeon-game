import GenericItem from "./GenericItem.js"
import run from "../Run.js"

export default class Amulet extends GenericItem {
    constructor(x, y) {
        super(x, y, 437)
        this.name = "Amulet"
        this.description = "The Amulet of Nano Dungeon."
        this.actionPoints = 1
    }

    turn() {
        this.actionPoints = 0
    }

    onPickup() {
        run.endRun("win")
    }

    refresh() {
        this.actionPoints = 1
    }

    over() {
        return this.actionPoints == 0
    }
}
