import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import tm from "../TurnManager.js"
import gameLog from "../GameLog.js"

const CRAFTY_TINT = 0xff8c1a

const crafty = {
    name: "Crafty",
    initialize: function () {
        if (this.type === "enemy") {
            this.tint = CRAFTY_TINT
            if (this.sprite) {
                this.sprite.tint = this.tint
                this.sprite.tintFill = false
            }
            this.name = `Crafty ${this.name}`
            this._stash = []
        }
    },
    turn() {
        if (this.type !== "enemy") return
        if (this.moving) return

        // Re-apply the Crafty tint each turn — behavior tags' initialize runs
        // after modifiers in addTag order and overwrites this.sprite.tint, so
        // we restore the visual tell so it isn't masked.
        if (this.sprite && this.sprite.tint !== CRAFTY_TINT) {
            this.sprite.tint = CRAFTY_TINT
            this.sprite.tintFill = false
        }

        if (this.movementPoints <= 0) return

        const candidates = [
            { x: this.x, y: this.y },
            { x: this.x + 1, y: this.y },
            { x: this.x - 1, y: this.y },
            { x: this.x, y: this.y + 1 },
            { x: this.x, y: this.y - 1 },
        ]
        for (const c of candidates) {
            const ent = mapState.entityAtTile(c.x, c.y)
            if (ent && ent.type === "item" && ent !== this) {
                tm.removeEntity(ent)
                if (ent.sprite) {
                    ent.sprite.destroy()
                    delete ent.sprite
                }
                this._stash.push(ent)
                gameLog.log(`${this.name} grabs ${ent.name}.`)
                this.movementPoints -= 1
                break
            }
        }
    },
    onDestroy() {
        if (this._stash && this._stash.length > 0) {
            for (const item of this._stash) {
                item.x = this.x
                item.y = this.y
                dungeon.initializeEntity(item)
                tm.addEntity(item)
                gameLog.log(`${this.name} drops ${item.name}.`)
            }
            this._stash = []
        }
    }
}

export default crafty
