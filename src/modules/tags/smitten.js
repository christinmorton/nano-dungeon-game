import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Smitten — the Holy affinity's rider (advanced/pact). Holy is Light EMBODIED:
// the judgment of angels. A radiant DoT that, like every DoT here, subtracts HP
// directly — divine judgment ignores armor and barrier (unblockable). Its hook is
// that judgment falls HARDER on the wicked: an "unholy" target (void/demonic/curse
// attunement, or already steeped in a dark status) takes DOUBLE the tick. The
// natural anti-demonic counter, the flip side of Demonic's Damned.

const SMITTEN_TINT = 0xfff0a0
const UNHOLY_AFFINITIES = ["void", "demonic", "curse"]
const UNHOLY_TAGS = ["Cursed", "Corruption", "Blight", "Doom", "Unmaking", "Damned"]

// Judged more harshly if the target serves the dark. (enemyKind 'undead' could
// join this once that taxonomy is read here.)
function isUnholy(entity) {
    // The unholy affinities (void/demonic/curse) all live in the advanced slot.
    if (UNHOLY_AFFINITIES.includes(entity?.affinityAdvanced)) return true
    const tags = entity?._tags || []
    return UNHOLY_TAGS.some(t => tags.includes(t))
}

const smitten = defineStatus({
    name: "Smitten",
    category: "dot",
    valence: "negative",
    icon: null,
    fx: "holy",
    duration: 3,
    initialize: function (damage = 2, turns = 3) {
        this._smiteDamage = damage
        this._smiteTurns = turns
        this._smiteActivated = false
        this._smitePrevTint = this.sprite?.tint
        if (this.sprite) {
            this.sprite.tint = SMITTEN_TINT
            this.sprite.tintFill = false
        }
        gameLog.log(`${this.name} is smitten by radiant judgment.`)
    },
    turn: function () {
        if (this._smiteTurns > 0 && !this._smiteActivated) {
            this._smiteActivated = true
            const dmg = this._smiteDamage * (isUnholy(this) ? 2 : 1)
            this.healthPoints -= dmg
            const note = dmg > this._smiteDamage ? " (judgment redoubled on the unholy)" : ""
            gameLog.log(`${this.name} is seared for ${dmg} by radiant judgment${note}.`)
            this._smiteTurns -= 1
        }
        if (this._smiteTurns <= 0) {
            this.removeTag(smitten)
        }
    },
    refresh: function () {
        this._smiteActivated = false   // re-arm the once-per-round tick
    },
    cleanup: function () {
        if (this.sprite) {
            if (this._smitePrevTint !== undefined) {
                this.sprite.tint = this._smitePrevTint
            } else {
                this.sprite.clearTint?.()
            }
        }
    }
})

export default smitten
