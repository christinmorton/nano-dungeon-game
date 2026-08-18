import Phaser from 'phaser'
import dungeon from "../Dungeon.js"
import tm from "../TurnManager.js"
import mapState from "../MapState.js"
import gameLog from "../GameLog.js"
import Container from "../items/Container.js"
import GreaterHealthPotion from "../items/GreaterHealthPotion.js"
import StaminaPotion from "../items/StaminaPotion.js"
import ScrollOfBlink from "../items/ScrollOfBlink.js"
import ScrollOfTeleport from "../items/ScrollOfTeleport.js"
import items from "../Items.js"

const ELITE_TINT = 0xff3333
const ENRAGE_THRESHOLD = 0.5
const ENRAGE_DAMAGE_BONUS = 2
const BLOCK_CHANCE = 0.20

// items.Helmet is a factory wrapper that returns an Armor instance —
// callable with `new` like the other class entries in this pool.
const ELITE_DROP_POOL = [
    GreaterHealthPotion,
    StaminaPotion,
    ScrollOfBlink,
    items.Helmet,
    ScrollOfTeleport
]

const eliteEnrager = {
    name: "Elite Enrager",
    initialize: function () {
        if (this.type !== "enemy") return

        this.maxHealthPoints = (this.maxHealthPoints || 1) * 4
        this.healthPoints = this.maxHealthPoints
        if (this.stats) this.stats.STR += 3
        this.movementPoints += 1
        this.actionPoints += 1
        if (this.refreshRates) {
            this.refreshRates.movementPoints += 1
            this.refreshRates.actionPoints += 1
        }
        this.tint = ELITE_TINT
        if (this.sprite) {
            this.sprite.tint = this.tint
            this.sprite.tintFill = false
        }
        this.name = `Elite ${this.name}`
        this._elite = true
        this._enraged = false
    },
    turn: function () {
        if (this.type !== "enemy") return
        // Re-apply the elite tint each turn so other tags' turn handlers
        // (Crafty in particular) don't mask it.
        if (this.sprite && this.sprite.tint !== ELITE_TINT) {
            this.sprite.tint = ELITE_TINT
            this.sprite.tintFill = false
        }
    },
    attack: function (baseAttack) {
        if (this.healthPoints < this.maxHealthPoints * ENRAGE_THRESHOLD) {
            if (!this._enraged) {
                this._enraged = true
                gameLog.log(`${this.name} enters a rage!`)
            }
            return baseAttack + ENRAGE_DAMAGE_BONUS
        }
        return baseAttack
    },
    blockAttack: function (baseResult, attacker) {
        if (baseResult) return baseResult
        if (attacker && attacker.type === "hero" && Math.random() < BLOCK_CHANCE) {
            return true
        }
        return false
    },
    onDestroy: function () {
        // BaseEnemy.onDestroy already created (or appended to) a loot
        // bag at this tile — drop our elite item into the same bag
        // rather than creating a sprite-bearing item on top of the
        // bag. A sprite at the same tile as the container made the
        // tile unwalkable AND uninteractable: the bag (type
        // "container") doesn't auto-pickup on arrow-step, so the
        // player couldn't reach the item underneath at all.
        const ItemClass = Phaser.Utils.Array.GetRandom(ELITE_DROP_POOL)
        const item = new ItemClass()
        const existing = mapState.containerAtTile(this.x, this.y)
        if (existing) {
            existing.contents.push(item)
        } else {
            tm.addEntity(new Container(this.x, this.y, "bag", [item]))
        }
        gameLog.log(`${this.name} drops a ${item.name}!`)
    }
}

export default eliteEnrager
