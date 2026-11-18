import Phaser from 'phaser'
import dungeon from '../Dungeon.js'
import tm from '../TurnManager.js'
import gameLog from '../GameLog.js'
import router from '../SceneRouter.js'
import audio from '../Audio.js'
import { addEntityIcon } from '../assetLoader.js'
import { INVENTORY_CAP } from '../items/Container.js'
import { buyPrice, sellPrice } from '../items/shopStock.js'
import { itemStatLine, equipDeltas, deltaText } from '../items/compare.js'

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
const COLOR_BAD = "#e06c5a"
const COLOR_GOOD = "#7ed08a"

// Two-line rows since 2026-10-03: name and price on the first line, the item's
// numbers and the change it would make on the second, so "worth buying?" is
// answered here rather than by buying it and opening the Character screen.
const ROW_H = 42
const PANEL_W = 380

// Shop — the modal buy/sell screen for the Camp room's shopkeeper (§10.11).
//
// Launched by SceneRouter.openShop(shopkeeper), which PAUSES World+UI so the
// dungeon freezes underneath and resumes them on close. That routing was already
// written and had simply never had a scene to point at.
//
// Two columns: the shopkeeper's stock on the left, the hero's sellable carry on
// the right. Clicking a row buys or sells it. Stock lives on the shopkeeper
// instance, so what is bought stays bought for the rest of the floor.
export default class Shop extends Phaser.Scene {
    constructor() {
        super({ key: "shop-scene", active: false })
    }

    create(data) {
        this._shopkeeper = (data && data.shopkeeper) || null
        this._rows = []

        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.88).setOrigin(0)

        const cx = GAME_W / 2
        this.add.text(cx, 48, "Shopkeeper", { font: "44px Arial", color: COLOR_ACCENT })
            .setOrigin(0.5)
        this.add.text(cx, 92, "Click an item to buy or sell   ·   Press Esc to leave", {
            font: "13px Arial", color: COLOR_DIM,
        }).setOrigin(0.5)

        this._coinText = this.add.text(cx, 118, "", { font: "16px Arial", color: COLOR_PRIMARY })
            .setOrigin(0.5)
        this._lineText = this.add.text(cx, 142, "", { font: "13px Arial", color: COLOR_ACCENT })
            .setOrigin(0.5)

        this._render()

        // The pointerup that OPENED this scene can still be in flight when this
        // listener registers, which would dismiss the shop instantly. Same
        // 150ms arming the Controls screen uses.
        this._armedAt = this.time.now + 150
        this.input.keyboard.on("keyup", (event) => {
            if (event.key !== "Escape") return
            this._close()
        })
    }

    _close() {
        if (this.time.now < this._armedAt) return
        router.bind(this)
        router.closeShop()
    }

    _coins() {
        const p = dungeon.player
        return (p && p.tallies && p.tallies.coins) || 0
    }

    _setLine(msg, bad = false) {
        this._lineText.setText(msg)
        this._lineText.setColor(bad ? COLOR_BAD : COLOR_ACCENT)
    }

    // Full redraw after every transaction. The panels are small (6 stock rows, at
    // most 10 carry rows) so rebuilding beats diffing two lists.
    _render() {
        for (const obj of this._rows) obj.destroy()
        this._rows = []

        this._coinText.setText(`Coins: ${this._coins()}`)

        const player = dungeon.player
        const stock = (this._shopkeeper && this._shopkeeper.stock) || []
        // Cursed items cannot be offloaded on the merchant — that is a different,
        // hostile design. Everything else the hero carries is sellable.
        this._sellable = ((player && player.items) || []).filter(i => !i.cursed)

        const leftX = cxLeft()
        const rightX = cxRight()
        const headY = 180

        this._header(leftX, headY, "FOR SALE")
        this._header(rightX, headY, "YOUR PACK")

        if (stock.length === 0) {
            this._note(leftX, headY + 34, "(sold out)")
        } else {
            stock.forEach((item, i) => {
                this._row(leftX, headY + 34 + i * ROW_H, item, buyPrice(item), "buy", () => this._buy(i))
            })
        }

        if (this._sellable.length === 0) {
            this._note(rightX, headY + 34, "(nothing to sell)")
        } else {
            this._sellable.forEach((item, i) => {
                this._row(rightX, headY + 34 + i * ROW_H, item, sellPrice(item), "sell", () => this._sell(i))
            })
        }
    }

    _header(x, y, label) {
        this._rows.push(
            this.add.text(x, y, label, { font: "15px Arial", color: COLOR_ACCENT }).setOrigin(0, 0.5),
            this.add.rectangle(x, y + 16, PANEL_W, 1, 0x7a7466, 0.5).setOrigin(0, 0.5)
        )
    }

    _note(x, y, msg) {
        this._rows.push(
            this.add.text(x, y, msg, { font: "13px Arial", color: COLOR_DIM }).setOrigin(0, 0.5)
        )
    }

    // One clickable item row: hit area, icon, name (+ stack count), price.
    _row(x, y, item, price, mode, onClick) {
        const hit = this.add.rectangle(x, y, PANEL_W, ROW_H - 2, 0xffffff, 0.001)
            .setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true })
        hit.on("pointerover", () => hit.setFillStyle(0xffffff, 0.07))
        hit.on("pointerout", () => hit.setFillStyle(0xffffff, 0.001))
        hit.on("pointerup", onClick)

        const icon = addEntityIcon(this, x + 8, y, item, {
            display: 16, originX: 0, originY: 0.5, tintFill: true,
        })

        // Stacked consumables render as "Health Potion x3" — the count is on the
        // item, not a separate row (see scope doc §10.10).
        const count = item.count > 1 ? ` x${item.count}` : ""
        const name = this.add.text(x + 32, y - 9, `${item.name}${count}`, {
            font: "14px Arial", color: COLOR_PRIMARY,
        }).setOrigin(0, 0.5)

        const affordable = mode === "sell" || this._coins() >= price
        const cost = this.add.text(x + PANEL_W - 8, y - 9, `${price}c`, {
            font: "14px Arial", color: affordable ? COLOR_PRIMARY : COLOR_BAD,
        }).setOrigin(1, 0.5)

        this._rows.push(hit, icon, name, cost)

        // Second line: the item's numbers, then the delta against what the hero
        // wears in that slot (green up, red down). Same helper the Character
        // screen uses, so the two can never disagree about an item. A potion has
        // neither and the line stays empty.
        const player = dungeon.player
        const line = itemStatLine(item)
        const { up, down } = deltaText(player ? equipDeltas(player, item) : null)
        let lx = x + 32
        const ly = y + 9
        if (line) {
            const t = this.add.text(lx, ly, line, { font: "11px Arial", color: COLOR_DIM }).setOrigin(0, 0.5)
            this._rows.push(t)
            lx += t.width + 10
        }
        if (up) {
            const t = this.add.text(lx, ly, up, { font: "bold 11px Arial", color: COLOR_GOOD }).setOrigin(0, 0.5)
            this._rows.push(t)
            lx += t.width + 10
        }
        if (down) {
            this._rows.push(this.add.text(lx, ly, down, { font: "bold 11px Arial", color: COLOR_BAD }).setOrigin(0, 0.5))
        }
    }

    _buy(idx) {
        const item = this._shopkeeper.stock[idx]
        if (!item) return
        const player = dungeon.player
        const price = buyPrice(item)

        if (this._coins() < price) {
            this._setLine("You cannot afford that.", true)
            audio.play('ui-error')
            return
        }
        // canAccept, not items.length — a FULL pack must still take an item that
        // merges into a stack it already holds, or stacking reads as broken.
        if (!player.inventory.canAccept(item)) {
            this._setLine("Your pack is full.", true)
            audio.play('ui-error')
            return
        }

        player.tallies.coins -= price
        // Mirror a chest pickup: into carry (which refreshes the HUD) and tracked
        // by the turn manager, exactly as Container.onInteract does.
        player.inventory.add(item)
        tm.addEntity(item)
        this._shopkeeper.stock.splice(idx, 1)

        audio.play('ui-select')
        gameLog.log(`Bought ${item.name} for ${price} coins.`)
        this._setLine(`Bought ${item.name}.`)
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
        // Reverse of pickup. removeAt takes ONE unit off a stack and leaves the
        // rest (§10.10), so selling a stack of three potions is three clicks at
        // one price each — which is the behaviour you want in a shop: selling
        // the whole stack by accident because it shared a row would be worse.
        // tm.removeEntity only when the entry actually left the pack, or the
        // remaining units would be untracked.
        const stillCarried = player.items.includes(item)
        player.inventory.removeAt(carryIndex)
        if (stillCarried && !player.items.includes(item)) tm.removeEntity(item)

        audio.play('ui-select')
        gameLog.log(`Sold ${item.name} for ${price} coins.`)
        this._setLine(`Sold ${item.name}.`)
        this._render()
    }
}

// Two panels centred as a pair, so the layout holds if PANEL_W changes.
function cxLeft() { return GAME_W / 2 - PANEL_W - 20 }
function cxRight() { return GAME_W / 2 + 20 }
