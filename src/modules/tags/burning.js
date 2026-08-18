import dungeon from "../Dungeon.js"
import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

const burning = defineStatus({
    name: "Burning",
    category: "dot",
    valence: "negative",
    icon: null,
    fx: "burning",
    duration: 3,
    initialize: function (damage = 2, howManyTurns = 3) {
        this._burnDamage = damage
        this._howManyTurns = howManyTurns
        if (this.type === "item") {
            this.tint = 0xff6622

            if (this.sprite) {
                this.sprite.tint = this.tint
                this.sprite.tintFill = false
            }
        } else {
            gameLog.log(`${this.name} is set ablaze.`)
        }
    },
    turn() {
        if (this.type !== "item") {
            if (this._howManyTurns > 0 && !this._burningActivated) {
                this._burningActivated = true
                this.healthPoints -= this._burnDamage
                this._howManyTurns -= 1
                gameLog.log(`${this.name} suffers ${this._burnDamage} hits from burning.`)
            }

            if (this._howManyTurns == 0) {
                this.removeTag(burning)
            }
        }
    },

    refresh() {
        this._burningActivated = false
    },

    damagedEntity(entity) {
        entity.addTag(burning)
        return entity
    }

})

export default burning