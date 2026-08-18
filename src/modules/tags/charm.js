import dungeon from "../Dungeon.js"
import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"
import { convertToAlly, snapshotAllegiance, revertAllegiance } from "../companions/allegiance.js"

// Charm — TEMPORARY mind control. On apply, snapshot the victim's allegiance and
// flip it to the charmer's side via convertToAlly: the charmed unit follows and
// fights for the caster through the existing ALLY archetype — the enemy
// captain/squad AI is never involved. Counts down each round; on expiry OR a
// cleanse/dispel it reverts to its original (hostile) allegiance through the
// cleanup hook, so there's a single restore path.
//
// Leader resolution: the `control` pattern stamps `_controlSource` on the victim
// before applying the tag (Taggable init-args can't carry an object cleanly);
// falls back to the player. Only ENEMIES convert — charming an ally/hero is a
// no-op flip (duration still tracked) so the verb is safe to point anywhere.

const charm = defineStatus({
    name: "Charm",
    category: "alteration",
    valence: "negative",
    icon: null,
    duration: 3,
    initialize: function (turns = 3) {
        this._charmTurns = turns
        if (this.type === "enemy") {
            this._charmSnapshot = snapshotAllegiance(this)
            convertToAlly(this, this._controlSource || dungeon.player)
            gameLog.log(`${this.name} is charmed and fights for you!`)
        } else {
            gameLog.log(`${this.name} is charmed.`)
        }
    },
    refresh: function (baseResult) {
        this._charmTurns -= 1
        if (this._charmTurns <= 0) this.removeTag(charm)   // → cleanup reverts
        return baseResult
    },
    cleanup: function () {
        // Fires on expiry AND on cleanse/dispel. Restore the original allegiance.
        if (this._charmSnapshot) {
            revertAllegiance(this, this._charmSnapshot)
            this._charmSnapshot = null
            gameLog.log(`${this.name} breaks free of the charm.`)
        }
    },
})

export default charm
