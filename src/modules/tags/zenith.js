import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// The Zenith — Light path (§19.6): the cold, sterile, merciless face — high noon with no
// shadow, the cleanse that burns away EVERYTHING, not just corruption. Every hit brands
// the target with a radiant burn that subtracts HP directly (unblockable — total order
// admits no defense). The Light's morally-uneasy extreme, made playable. Rank scales the
// burn the bearer stamps; read live off `affinityPaths.zenith.rank`.

const ZENITH_TINT = 0xeaf6ff

const zenithBurn = defineStatus({
    name: "Zenith's Light",
    category: "dot",
    valence: "negative",
    fx: "holy",
    duration: 3,
    initialize: function (damage = 3, turns = 3) {
        this._zenDamage = damage
        this._zenTurns = turns
        this._zenActivated = false
        this._zenPrevTint = this.sprite?.tint
        if (this.sprite) { this.sprite.tint = ZENITH_TINT; this.sprite.tintFill = false }
        gameLog.log(`${this.name} is seared by the Zenith's light.`)
    },
    turn: function () {
        if (this._zenTurns > 0 && !this._zenActivated) {
            this._zenActivated = true
            this.healthPoints -= this._zenDamage
            gameLog.log(`${this.name} burns in the merciless light for ${this._zenDamage}.`)
            this._zenTurns -= 1
        }
        if (this._zenTurns <= 0) this.removeTag(zenithBurn)
    },
    refresh: function () { this._zenActivated = false },
    cleanup: function () {
        if (this.sprite) {
            if (this._zenPrevTint !== undefined) this.sprite.tint = this._zenPrevTint
            else this.sprite.clearTint?.()
        }
    },
})

function zenithDamage(rank) { return 2 + (rank || 1) }

export function applyZenith(victim, rank = 1) {
    if (!victim) return
    const dmg = zenithDamage(rank)
    if (victim._tags?.includes("Zenith's Light")) {
        victim._zenDamage = Math.max(victim._zenDamage || 0, dmg)
        victim._zenTurns = 3
    } else {
        victim.addTag(zenithBurn, dmg, 3)
    }
}

// Hero-side: brand every struck foe with the Zenith's burn. This is the tag the path
// passive attaches to the bearer (NOT the victim DoT above).
export const zenith = defineStatus({
    name: "The Zenith",
    category: "buff",
    valence: "mixed",
    duration: null,
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) {
            applyZenith(victim, this.affinityPaths?.zenith?.rank || 1)
        }
        return ret
    },
})

export function zenithReadout(entity, rank = 1) {
    return `stamps ${zenithDamage(rank)}/turn radiant burn on hit · unblockable`
}

export default zenithBurn
