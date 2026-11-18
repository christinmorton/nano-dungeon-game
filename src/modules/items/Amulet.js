import GenericItem from "./GenericItem.js"
import run from "../Run.js"
import audio from "../Audio.js"

export default class Amulet extends GenericItem {
    constructor(x, y) {
        super(x, y, 437)
        this.name = "Amulet"
        // Deliberately does NOT name the game (scope doc §10.19). The title is the
        // Company — the people who came down here — and the amulet is older than
        // they are and indifferent to them. "The Amulet of The Lantern Company"
        // would say the band owns it, which inverts the premise. This is the text
        // the player reads at the most important moment of a run, so it carries the
        // age and the indifference instead of the branding.
        this.description = "An amulet of crystallized twilight. It was old before the Hollow was a wound."
        this.actionPoints = 1
    }

    turn() {
        this.actionPoints = 0
    }

    onPickup() {
        // The run's one triumphant moment — a bigger fanfare than the score
        // screen's, played here so it lands on the pickup itself.
        audio.stopMusic()
        audio.play('fanfare-amulet')
        run.endRun("win")
    }

    refresh() {
        this.actionPoints = 1
    }

    over() {
        return this.actionPoints == 0
    }
}
