import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Extended Reach — a Spatial enchant on the bearer's MELEE weapon: space folds
// around the blade so it strikes from further away. While active, the entity's
// `_reachBonus` adds to its melee attack range (HeroController's range gate reads
// it, gated to melee weapons — a bow isn't affected). The Spatial tree's Reach
// ability grants it; rank scales the bonus + duration. Spears/long weapons already
// start further out (profile range 3 vs a blade's 2), so they naturally reach
// furthest with the same bonus.
//
// Mechanic note: the TEMPORARY form (a timed buff) is what's built. A PERMANENT-
// for-the-run enchant + an enchant-statue room + per-weaponCategory scaling are
// parked (see the encyclopedia Spatial / melee-enchant capture).

const REACH_TINT = 0xc0a0ff

const extendedReach = defineStatus({
    name: "Extended Reach",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 5,
    initialize: function (turns = 5, bonus = 1) {
        this._reachTurns = turns
        this._reachBonus = bonus            // HeroController adds this to melee range
        this._reachPrevTint = this.sprite?.tint
        if (this.sprite) {
            this.sprite.tint = REACH_TINT
            this.sprite.tintFill = false
        }
        gameLog.log(`${this.name}'s weapon reach is extended (+${bonus}).`)
    },
    refresh: function (baseResult) {
        this._reachTurns -= 1
        if (this._reachTurns <= 0) {
            this.removeTag(extendedReach)
            gameLog.log(`${this.name}'s reach returns to normal.`)
        }
        return baseResult
    },
    cleanup: function () {
        this._reachBonus = 0
        if (this.sprite) {
            if (this._reachPrevTint !== undefined) this.sprite.tint = this._reachPrevTint
            else this.sprite.clearTint?.()
        }
    }
})

export default extendedReach
