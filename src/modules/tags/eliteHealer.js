import Phaser from 'phaser'
import dungeon from "../Dungeon.js"
import tm from "../TurnManager.js"
import mapState from "../MapState.js"
import { spawnHealNumber } from "../Animations.js"
import gameLog from "../GameLog.js"
import Container from "../items/Container.js"
import GreaterHealthPotion from "../items/GreaterHealthPotion.js"
import StaminaPotion from "../items/StaminaPotion.js"
import ScrollOfBlink from "../items/ScrollOfBlink.js"
import ScrollOfTeleport from "../items/ScrollOfTeleport.js"
import items from "../Items.js"

const ELITE_TINT = 0xff3333
const HEAL_THRESHOLD = 0.25
const HEAL_TARGET_FRACTION = 0.5
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

const eliteHealer = {
    name: "Elite Healer",
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
        this._hasHealed = false
    },
    turn: function () {
        if (this.type !== "enemy") return
        if (this.sprite && this.sprite.tint !== ELITE_TINT) {
            this.sprite.tint = ELITE_TINT
            this.sprite.tintFill = false
        }
        if (!this._hasHealed && this.healthPoints < this.maxHealthPoints * HEAL_THRESHOLD) {
            this._hasHealed = true
            const healTarget = Math.floor(this.maxHealthPoints * HEAL_TARGET_FRACTION)
            const healAmount = Math.max(0, healTarget - this.healthPoints)
            this.healthPoints = Math.min(this.maxHealthPoints, this.healthPoints + healAmount)
            gameLog.log(`${this.name} heals itself!`)
            if (healAmount > 0) spawnHealNumber(this, healAmount)
        }
    },
    blockAttack: function (baseResult, attacker) {
        if (baseResult) return baseResult
        if (attacker && attacker.type === "hero" && Math.random() < BLOCK_CHANCE) {
            return true
        }
        return false
    },
    onDestroy: function () {
        // Drop the elite item into BaseEnemy's loot bag at this tile
        // rather than as a separate sprite — see eliteEnrager for the
        // full rationale (bag + raw item on same tile made the tile
        // unreachable to the player).
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

export default eliteHealer
