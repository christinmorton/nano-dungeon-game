import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Oil-Slicked — movement slides an extra tile uncontrollably, and a fire-
// flavored hit ignites the entity (applying Burning). STUB: needs a
// movement-distance modifier plus a fire-flavor ignite hook in Combat,
// neither of which exists. Duration handling below is real; the slide and
// ignite are a TODO.

const oilSlicked = defineStatus({
    name: "Oil-Slicked",
    category: "spatial",
    valence: "mixed",
    icon: null,
    duration: 3,
    initialize: function (turns = 3) {
        this._oilTurns = turns
        gameLog.log(`${this.name} is slick with oil.`)
    },
    refresh: function (baseResult) {
        this._oilTurns -= 1
        if (this._oilTurns <= 0) {
            this.removeTag(oilSlicked)
            gameLog.log(`${this.name} is no longer oily.`)
        }
        return baseResult
    }
    // TODO: add uncontrolled extra movement + ignite (apply Burning) on fire-flavored hits.
})

export default oilSlicked
