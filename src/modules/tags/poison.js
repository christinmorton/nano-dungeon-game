import dungeon from "../Dungeon.js"
import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

const poison = defineStatus({
    name: "Poison",
    category: "dot",
    valence: "negative",
    icon: null,
    fx: "poison",
    duration: 10,
    initialize: function (damage = 1, howManyTurns = 10) {
        this._poisonDamage = damage
        this._howManyTurns = howManyTurns
        if (this.type === "item") {
            this.tint = 0x44cc44

            if (this.sprite) {
                this.sprite.tint = this.tint
                this.sprite.tintFill = false
            }
        } else {
            gameLog.log(`${this.name} is poisoned.`)
        }
    },
    turn() {
        if (this.type !== "item") {
            if (this._howManyTurns > 0 && !this._poisonActivated) {
                this._poisonActivated = true
                this.healthPoints -= this._poisonDamage
                this._howManyTurns -= 1
                gameLog.log(`${this.name} suffers ${this._poisonDamage} from poison.`)
            }

            if (this._howManyTurns == 0) {
                this.removeTag(poison)
            }
        }
    },

    refresh() {
        this._poisonActivated = false
    },

    damagedEntity(entity) {
        entity.addTag(poison)
        return entity
    }

})

// Apply OR refresh Poison with explicit numbers. addTag dedups by name, so a
// second addTag(poison) on an already-poisoned victim is a no-op (won't re-run
// initialize). This helper instead REFRESHES the timer and takes the stronger
// per-turn damage, so re-poisoning actually matters — the correct way for the
// Decay tree to layer venom. Mirrors applyAcid / applyCorrosion.
export function applyPoison(victim, damage = 1, turns = 10) {
    if (!victim) return
    if (victim._tags?.includes("Poison")) {
        victim._poisonDamage = Math.max(victim._poisonDamage || 0, damage)
        victim._howManyTurns = Math.max(victim._howManyTurns || 0, turns)
        gameLog.log(`${victim.name}'s poison is refreshed.`)
    } else {
        victim.addTag(poison, damage, turns)
    }
}

export default poison