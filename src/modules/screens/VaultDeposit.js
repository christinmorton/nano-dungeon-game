import Phaser from 'phaser'
import dungeon from '../Dungeon.js'
import account from '../Account.js'
import router from '../SceneRouter.js'
import { serialize, deserialize, isDepositable } from '../ItemSerializer.js'
import { addEntityIcon, preloadSheets, GAME_SHEETS } from '../assetLoader.js'

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
const COLOR_OK = "#86efac"

const INV_COLS = 5
const INV_ROWS = 2
const VAULT_COLS = 6
const VAULT_ROWS = 5
const CELL = 40
const GAP = 6

export default class VaultDeposit extends Phaser.Scene {
    constructor() {
        super({ key: "vault-deposit-scene", active: false })
    }

    preload() {
        // World preloads "tiles" too, but defensively re-declare so this
        // scene works even if launched before World (e.g., a future flow
        // that surfaces vault contents from the menu).
        if (!this.textures.exists("tiles")) {
            this.load.spritesheet("tiles", "kenney_1-bit-pack/Tilesheet/colored-transparent.png", {
                frameWidth: 16,
                frameHeight: 16,
                spacing: 1
            })
        }
        preloadSheets(this, GAME_SHEETS)
    }

    create() {
        // Live item instances. Inventory starts as the player's depositable
        // items; vault starts as deserialized records from account so the
        // grid can render their sprites and we can re-serialize on save.
        const player = dungeon.player
        const playerItems = (player && player.items) || []
        this._inventory = playerItems.filter(isDepositable)

        // Vault records loaded as instances for display.
        this._vault = account.getVault()
            .map(record => deserialize(record))
            .filter(Boolean)

        this._capacity = account.vaultCapacity()

        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.92).setOrigin(0)

        const cx = GAME_W / 2

        this.add.text(cx, 50, "Deposit to Vault", {
            font: "44px Arial",
            color: COLOR_ACCENT
        }).setOrigin(0.5)

        this.add.text(cx, 90, "Click an item to move it between inventory and vault. Continue to save.", {
            font: "14px Arial",
            color: COLOR_DIM
        }).setOrigin(0.5)

        // Section labels are static; their bodies (item sprites) live in
        // _bodyLayer so we can clear and re-render on every click.
        this._invLabelText = this.add.text(cx, 130, "", {
            font: "14px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(0.5)

        this._vaultLabelText = this.add.text(cx, 280, "", {
            font: "14px Arial",
            color: COLOR_PRIMARY
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

        // Continue: serialize current vault state, persist, close.
        this._makeButton(cx, GAME_H - 100, "Continue", () => this._commit())

        this.add.text(cx, GAME_H - 60, "Cursed items are excluded automatically.", {
            font: "12px Arial",
            color: COLOR_DIM
        }).setOrigin(0.5)
    }

    _render() {
        // Wipe re-renderable widgets.
        this._bodyLayer.forEach(w => w.destroy())
        this._bodyLayer = []

        const cx = GAME_W / 2

        this._invLabelText.setText(`Run inventory  (${this._inventory.length})`)
        this._vaultLabelText.setText(`Vault  (${this._vault.length}/${this._capacity})`)

        this._renderGrid({
            items: this._inventory,
            cols: INV_COLS,
            rows: INV_ROWS,
            cx,
            topY: 160,
            onCellClick: (idx) => this._depositFromInventory(idx),
            emptyCellHint: null
        })

        this._renderGrid({
            items: this._vault,
            cols: VAULT_COLS,
            rows: VAULT_ROWS,
            cx,
            topY: 310,
            onCellClick: (idx) => this._removeFromVault(idx),
            emptyCellHint: null
        })
    }

    _renderGrid({ items, cols, rows, cx, topY, onCellClick }) {
        const totalW = cols * CELL + (cols - 1) * GAP
        const startX = cx - totalW / 2
        const totalCells = cols * rows

        for (let i = 0; i < totalCells; i++) {
            const col = i % cols
            const row = Math.floor(i / cols)
            const cellX = startX + col * (CELL + GAP)
            const cellY = topY + row * (CELL + GAP)
            const slot = this.add.rectangle(cellX, cellY, CELL, CELL, 0x2a2a2a, 0.8)
                .setOrigin(0)
                .setStrokeStyle(1, 0x4a4a4a)
            this._bodyLayer.push(slot)

            const item = items[i]
            if (item) {
                const sprite = addEntityIcon(this, cellX + CELL / 2, cellY + CELL / 2, item, { display: 32 })
                this._bodyLayer.push(sprite)

                slot.setInteractive({ useHandCursor: true })
                slot.on("pointerover", () => {
                    slot.setFillStyle(0x3a3a3a, 0.9)
                    this._showTooltip(item, cellX, cellY)
                })
                slot.on("pointerout", () => {
                    slot.setFillStyle(0x2a2a2a, 0.8)
                    this._tooltip.setVisible(false)
                })
                slot.on("pointerup", () => onCellClick(i))
            }
        }
    }

    _depositFromInventory(idx) {
        if (this._vault.length >= this._capacity) {
            this._flashTooltip("Vault is full.")
            return
        }
        const item = this._inventory[idx]
        if (!item) return
        this._inventory.splice(idx, 1)
        this._vault.push(item)
        this._render()
    }

    _removeFromVault(idx) {
        const item = this._vault[idx]
        if (!item) return
        this._vault.splice(idx, 1)
        // Discarded vault items are gone — by design, the player can't
        // hoard infinitely. Putting them "back into inventory" wouldn't
        // make sense at run end, so they vanish.
        this._render()
    }

    _showTooltip(item, cellX, cellY) {
        const tagText = item._tags && item._tags.length
            ? "\n" + item._tags.map(t => `#${t}`).join(" ")
            : ""
        const desc = item.description ? `\n${item.description}` : ""
        this._tooltip.setText(`${item.name}${tagText}${desc}`)
        this._tooltip.setPosition(cellX + CELL + 6, cellY)
        this._tooltip.setVisible(true)
    }

    _flashTooltip(msg) {
        this._tooltip.setText(msg)
        this._tooltip.setPosition(GAME_W / 2 - 60, GAME_H - 140)
        this._tooltip.setVisible(true)
        this.time.delayedCall(900, () => this._tooltip.setVisible(false))
    }

    _commit() {
        const records = this._vault.map(serialize).filter(Boolean)
        account.setVault(records)
        router.bind(this)
        router.closeVaultDeposit()
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

