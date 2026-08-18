import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Wet — doubles lightning damage taken and grants immunity to Burning.
// STUB: both effects need element-flavor interception in Combat — step 6
// applies fire->Burning today but has no per-victim flavor modifiers, and
// there's no pre-apply hook to refuse the Burning tag. Duration handling
// below is real; the element interactions are a TODO.

const wet = defineStatus({
    name: "Wet",
    category: "spatial",
    valence: "mixed",
    icon: null,
    duration: 3,
    initialize: function (turns = 3) {
        this._wetTurns = turns
        gameLog.log(`${this.name} is soaked.`)
    },
    refresh: function (baseResult) {
        this._wetTurns -= 1
        if (this._wetTurns <= 0) {
            this.removeTag(wet)
            gameLog.log(`${this.name} dries off.`)
        }
        return baseResult
    }
    // TODO: 2x lightning-flavored damage taken + reject Burning application (Combat step 6).
})

export default wet
