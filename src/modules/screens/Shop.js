import Phaser from 'phaser'
import dungeon from '../Dungeon.js'
import tm from '../TurnManager.js'
import router from '../SceneRouter.js'
import gameLog from '../GameLog.js'
import { INVENTORY_CAP } from '../items/Container.js'
import { shopkeeperLine } from '../dialog/npcBarks.js'
import { addEntityIcon, preloadSheets, GAME_SHEETS } from '../assetLoader.js'

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
const COLOR_OK = "#86efac"
const COLOR_SPEECH = "#e7d9b0"

const COLS = 5
const ROWS = 2
const CELL = 40
const GAP = 6

// Pricing. Items that carry a coin value (gems) price off that; everything
// else falls back by broad category. Selling pays a fraction of buy price.
// All tunable — this is the shape, not the economy balance.
const BUY_FALLBACK_WEAPON = 14
const BUY_FALLBACK_WEARABLE = 10
const BUY_FALLBACK_CONSUMABLE = 6
const SELL_RATE = 0.5

function buyPrice(item) {
    if (typeof item.value === "function") {
        const v = item.value()
        if (typeof v === "number" && v > 0) return v
    }
    if (item.weapon) return BUY_FALLBACK_WEAPON
    if (item.slot) return BUY_FALLBACK_WEARABLE
    return BUY_FALLBACK_CONSUMABLE
}

function sellPrice(item) {
    return Math.max(1, Math.floor(buyPrice(item) * SELL_RATE))
}

// Buy/sell screen for a single shopkeeper. The shopkeeper instance is handed
// in via launch data; its `stock` array is mutated directly so purchases
// persist if the player re-opens the same merchant. Coins live on the hero's
// tally. The world + UI scenes are paused behind this (see SceneRouter), so
// the merchant "speaks" through the line of text at the top rather than a
// world speech bubble.
export default class Shop extends Phaser.Scene {
    constructor() {
        super({ key: "shop-scene", active: false })
    }

    preload() {
        if (!this.textures.exists("tiles")) {
            this.load.spritesheet("tiles", "kenney_1-bit-pack/Tilesheet/colored-transparent.png", {
                frameWidth: 16,
                frameHeight: 16,
                spacing: 1
            })
        }
        preloadSheets(this, GAME_SHEETS)
    }

    create(data) {
        this._shopkeeper = data && data.shopkeeper
        if (!this._shopkeeper) {
            // Defensive: nothing to trade with — bounce back to the world.
            router.bind(this)
            router.closeShop()
            return
        }

        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.92).setOrigin(0)

        const cx = GAME_W / 2

        this.add.text(cx, 44, "Shopkeeper", {
            font: "44px Arial",
            color: COLOR_ACCENT
        }).setOrigin(0.5)

        // The merchant's spoken line. Greet on first visit this floor,
        // a lighter line on return.
        this._speechText = this.add.text(cx, 88, "", {
            font: "16px Arial",
            color: COLOR_SPEECH,
            fontStyle: "italic"
        }).setOrigin(0.5)
        this._setLine(shopkeeperLine(this._shopkeeper.greeted ? "backAgain" : "greet"))
        this._shopkeeper.greeted = true

        this._coinsText = this.add.text(cx, 120, "", {
            font: "18px Arial",
            color: COLOR_ACCENT
        }).setOrigin(0.5)

        // Static column headers; the cells below them live in _bodyLayer and
        // are wiped/redrawn on each transaction.
        this._buyLabel = this.add.text(GAME_W * 0.30, 160, "", {
            font: "14px Arial", color: COLOR_PRIMARY
        }).setOrigin(0.5)
        this._sellLabel = this.add.text(GAME_W * 0.70, 160, "", {
            font: "14px Arial", color: COLOR_PRIMARY
        }).setOrigin(0.5)

        this._tooltip = this.add.text(0, 0, "", {
            font: "12px Arial",
            color: "#fff",
            backgroundColor: "#000000cc",
            padding: { x: 6, y: 4 },
            wordWrap: { width: 220 }
        }).setDepth(1000).setVisible(false)

        this._bodyLayer = []
        this._render()

        this._makeButton(cx, GAME_H - 90, "Leave", () => {
            this._setLine(shopkeeperLine("leave"))
            router.bind(this)
            router.closeShop()
        })

        this.add.text(cx, GAME_H - 48, "Click an item on the left to buy, on the right to sell.", {
            font: "12px Arial",
            color: COLOR_DIM
        }).setOrigin(0.5)
    }

    _coins() {
        const p = dungeon.player
        return (p && p.tallies && p.tallies.coins) || 0
    }

    _setLine(text) {
        this._speechText.setText(`"${text}"`)
    }

    _render() {
        this._bodyLayer.forEach(w => w.destroy())
        this._bodyLayer = []

        const player = dungeon.player
        this._sellable = ((player && player.items) || []).filter(i => !i.cursed)
        const stock = this._shopkeeper.stock

        this._coinsText.setText(`Coins: ${this._coins()}`)
        this._buyLabel.setText(`For sale  (${stock.length})`)
        this._sellLabel.setText(`Your pack  (${this._sellable.length}/${INVENTORY_CAP})`)

        this._renderGrid({
            items: stock,
            cx: GAME_W * 0.30,
            topY: 185,
            priceFn: buyPrice,
            verb: "Buy",
            onCellClick: (idx) => this._buy(idx)
        })

        this._renderGrid({
            items: this._sellable,
            cx: GAME_W * 0.70,
            topY: 185,
            priceFn: sellPrice,
            verb: "Sell",
            onCellClick: (idx) => this._sell(idx)
        })
    }

    _renderGrid({ items, cx, topY, priceFn, verb, onCellClick }) {
        const totalW = COLS * CELL + (COLS - 1) * GAP
        const startX = cx - totalW / 2
        const totalCells = COLS * ROWS

        for (let i = 0; i < totalCells; i++) {
            const col = i % COLS
            const row = Math.floor(i / COLS)
            const cellX = startX + col * (CELL + GAP)
            const cellY = topY + row * (CELL + GAP)
            const slot = this.add.rectangle(cellX, cellY, CELL, CELL, 0x2a2a2a, 0.8)
                .setOrigin(0)
                .setStrokeStyle(1, 0x4a4a4a)
            this._bodyLayer.push(slot)

            const item = items[i]
            if (!item) continue

            const sprite = addEntityIcon(this, cellX + CELL / 2, cellY + CELL / 2, item, { display: 32 })
            this._bodyLayer.push(sprite)

            const price = priceFn(item)
            const priceLabel = this.add.text(cellX + CELL / 2, cellY + CELL - 4, `${price}`, {
                font: "11px Arial", color: COLOR_ACCENT
            }).setOrigin(0.5, 1)
            this._bodyLayer.push(priceLabel)

            slot.setInteractive({ useHandCursor: true })
            slot.on("pointerover", () => {
                slot.setFillStyle(0x3a3a3a, 0.9)
                this._showTooltip(item, `${verb}: ${price} coins`, cellX, cellY)
            })
            slot.on("pointerout", () => {
                slot.setFillStyle(0x2a2a2a, 0.8)
                this._tooltip.setVisible(false)
            })
            slot.on("pointerup", () => onCellClick(i))
        }
    }

    _buy(idx) {
        const item = this._shopkeeper.stock[idx]
        if (!item) return
        const price = buyPrice(item)
        if (this._coins() < price) {
            this._setLine(shopkeeperLine("cantAfford"))
            return
        }
        const player = dungeon.player
        if (player.items.length >= INVENTORY_CAP) {
            this._setLine(shopkeeperLine("full"))
            return
        }
        player.tallies.coins -= price
        // Mirror a chest pickup: into carry (HUD refresh) + tracked by tm.
        player.inventory.add(item)
        tm.addEntity(item)
        this._shopkeeper.stock.splice(idx, 1)
        gameLog.log(`Bought ${item.name} for ${price} coins.`)
        this._setLine(shopkeeperLine("buy"))
        this._render()
    }

    _sell(idx) {
        const item = this._sellable[idx]
        if (!item) return
        const player = dungeon.player
        const carryIndex = player.items.indexOf(item)
        if (carryIndex === -1) return
        const price = sellPrice(item)
        player.tallies.coins += price
        // Reverse of pickup: out of carry (HUD refresh) + untracked by tm.
        player.inventory.removeAt(carryIndex)
        tm.removeEntity(item)
        gameLog.log(`Sold ${item.name} for ${price} coins.`)
        this._setLine(shopkeeperLine("sell"))
        this._render()
    }

    _showTooltip(item, priceText, cellX, cellY) {
        const tagText = item._tags && item._tags.length
            ? "\n" + item._tags.map(t => `#${t}`).join(" ")
            : ""
        const desc = item.description ? `\n${item.description}` : ""
        this._tooltip.setText(`${item.name}${tagText}${desc}\n${priceText}`)
        this._tooltip.setPosition(cellX + CELL + 6, cellY)
        this._tooltip.setVisible(true)
    }

    _makeButton(x, y, label, onClick, textColor = COLOR_OK) {
        const w = 220
        const h = 40
        const rect = this.add.rectangle(x, y, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        this.add.text(x, y, label, { font: "18px Arial", color: textColor }).setOrigin(0.5)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", onClick)
    }
}
