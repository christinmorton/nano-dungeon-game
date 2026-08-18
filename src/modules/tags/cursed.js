import dungeon from "../Dungeon.js"
import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

const cursed = defineStatus({
    name: "Cursed",
    category: "debuff",
    valence: "negative",
    icon: null,
    fx: "cursed",
    duration: 5,
    initialize: function (damage = 1, howManyTurns = 5) {
        this._curseDamage = damage
        this._howManyTurns = howManyTurns
        if (this.type === "item") {
            this.tint = 0x8822cc

            if (this.sprite) {
                this.sprite.tint = this.tint
                this.sprite.tintFill = false
            }
        } else {
            gameLog.log(`${this.name} is cursed.`)
        }
    },
    turn() {
        if (this.type !== "item") {
            if (this._howManyTurns > 0 && !this._curseActivated) {
                this._curseActivated = true
                this.healthPoints -= this._curseDamage
                this._howManyTurns -= 1
                gameLog.log(`${this.name} suffers ${this._curseDamage} from curse.`)
            }
        }
        
        if (this._howManyTurns == 0) {
            this.removeTag(cursed)
        }
    },

    refresh() {
        this._curseActivated = false
    },

    damagedEntity(entity) {
        entity.addTag(cursed)
        return entity
    }

})

export default cursed