import Phaser from 'phaser'
import dungeon from '../Dungeon.js'
import account from '../Account.js'
import router from '../SceneRouter.js'
import { serialize, deserialize } from '../ItemSerializer.js'
import { addEntityIcon, preloadSheets, GAME_SHEETS } from '../assetLoader.js'
import inputMap from '../InputMap.js'
import classes from '../Classes.js'
import { abilityByName } from '../classes/abilities/abilityRegistry.js'

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
const COLOR_OK = "#86efac"

const VAULT_COLS = 6
const VAULT_ROWS = 5
const LOADOUT_COLS = 5
const LOADOUT_ROWS = 2
const LOADOUT_MAX = LOADOUT_COLS * LOADOUT_ROWS  // 10
const CELL = 40
const GAP = 6

export default class Loadout extends Phaser.Scene {
    constructor() {
        super({ key: "loadout-scene", active: false })
    }

    preload() {
        // Loadout opens from Intro before World ever runs, so the tilesheet
        // World normally preloads isn't in the TextureManager yet. Same
        // spritesheet config as World.preload — keeps the two in sync.
        if (!this.textures.exists("tiles")) {
            this.load.spritesheet("tiles", "kenney_1-bit-pack/Tilesheet/colored-transparent.png", {
                frameWidth: 16,
                frameHeight: 16,
                spacing: 1
            })
        }
        // Loadout can open before World, so load the item/hero art it shows.
        preloadSheets(this, GAME_SHEETS)
    }

    create() {
        // Live item instances rebuilt from records so the grid can render
        // their sprites. On confirm, the remaining vault is re-serialized.
        this._vault = account.getVault()
            .map(record => deserialize(record))
            .filter(Boolean)
        this._loadout = []
        this._capacity = account.vaultCapacity()

        // Banked abilities the player may bring this run (§14 B4 picker). Capacity
        // = the class's free NORMAL bar slots (total normal slots minus its kit);
        // the Ultimate slot is reserved. Default selection brings as many as fit.
        this._banked = account.getLearnedAbilities()
            .map(k => abilityByName(k))
            .filter(Boolean)
        const profile = classes[dungeon.hero]
        const kitSize = (profile?.abilities || []).length
        this._abilityCapacity = Math.max(0, inputMap.ultimateSlotIndex - kitSize)
        this._selectedKeys = new Set(
            this._banked.slice(0, this._abilityCapacity).map(m => m.key)
        )
        this._abilityLayer = []

        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.92).setOrigin(0)

        const cx = GAME_W / 2

        this.add.text(cx, 50, "Choose your starting kit", {
            font: "44px Arial",
            color: COLOR_ACCENT
        }).setOrigin(0.5)

        this.add.text(cx, 90, `Pick up to ${LOADOUT_MAX} items from the vault. Selected items leave the vault when the run starts.`, {
            font: "14px Arial",
            color: COLOR_DIM
        }).setOrigin(0.5)

        this._vaultLabelText = this.add.text(cx, 130, "", {
            font: "14px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(0.5)

        this._loadoutLabelText = this.add.text(cx, 410, "", {
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
        this._buildAbilities()

        this._makeButton(cx - 130, GAME_H - 100, "Skip", () => this._skip(), COLOR_PRIMARY)
        this._makeButton(cx + 130, GAME_H - 100, "Confirm", () => this._confirm(), COLOR_OK)

        this.add.text(cx, GAME_H - 60, "Anything you take into the run can be lost if you die.", {
            font: "12px Arial",
            color: COLOR_DIM
        }).setOrigin(0.5)
    }

    _render() {
        this._bodyLayer.forEach(w => w.destroy())
        this._bodyLayer = []

        const cx = GAME_W / 2

        this._vaultLabelText.setText(`Vault  (${this._vault.length}/${this._capacity})`)
        this._loadoutLabelText.setText(`Loadout  (${this._loadout.length}/${LOADOUT_MAX})`)

        this._renderGrid({
            items: this._vault,
            cols: VAULT_COLS,
            rows: VAULT_ROWS,
            cx,
            topY: 160,
            onCellClick: (idx) => this._addToLoadout(idx)
        })

        this._renderGrid({
            items: this._loadout,
            cols: LOADOUT_COLS,
            rows: LOADOUT_ROWS,
            cx,
            topY: 440,
            onCellClick: (idx) => this._returnToVault(idx)
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

    _addToLoadout(idx) {
        if (this._loadout.length >= LOADOUT_MAX) {
            this._flashTooltip("Loadout is full.")
            return
        }
        const item = this._vault[idx]
        if (!item) return
        this._vault.splice(idx, 1)
        this._loadout.push(item)
        this._render()
    }

    _returnToVault(idx) {
        const item = this._loadout[idx]
        if (!item) return
        this._loadout.splice(idx, 1)
        this._vault.push(item)
        this._render()
    }

    // The §14 B4 ability picker: a row of the player's banked abilities, each a
    // toggle (bring / leave). Rebuilds its own layer on each toggle so item-grid
    // re-renders never touch it. Hidden entirely when nothing is banked.
    _buildAbilities() {
        this._abilityLayer.forEach(w => w.destroy())
        this._abilityLayer = []
        if (!this._banked.length) return

        const cx = GAME_W / 2
        const labelY = 560

        const label = this.add.text(cx, labelY, `Bring learned abilities  (${this._selectedKeys.size}/${this._abilityCapacity})`, {
            font: "14px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(0.5)
        this._abilityLayer.push(label)

        const cols = Math.min(this._banked.length, 10)
        const totalW = cols * CELL + (cols - 1) * GAP
        const startX = cx - totalW / 2
        const topY = labelY + 24

        this._banked.forEach((meta, i) => {
            const col = i % cols
            const row = Math.floor(i / cols)
            const cellX = startX + col * (CELL + GAP)
            const cellY = topY + row * (CELL + GAP)
            const selected = this._selectedKeys.has(meta.key)

            const cell = this.add.rectangle(cellX, cellY, CELL, CELL, selected ? 0x14532d : 0x2a2a2a, 0.9)
                .setOrigin(0)
                .setStrokeStyle(2, selected ? 0x86efac : 0x4a4a4a)
            const icon = this.add.image(cellX + CELL / 2, cellY + CELL / 2, "tiles", meta.icon).setScale(2)
            if (!selected) icon.setAlpha(0.45)
            this._abilityLayer.push(cell, icon)

            cell.setInteractive({ useHandCursor: true })
            cell.on("pointerover", () => this._showAbilityTip(meta, cellX, cellY))
            cell.on("pointerout", () => this._tooltip.setVisible(false))
            cell.on("pointerup", () => this._toggleAbility(meta.key))
        })
    }

    _toggleAbility(key) {
        if (this._selectedKeys.has(key)) {
            this._selectedKeys.delete(key)
        } else if (this._selectedKeys.size >= this._abilityCapacity) {
            const n = this._abilityCapacity
            this._flashTooltip(`Only ${n} ability slot${n === 1 ? "" : "s"} free this run.`)
            return
        } else {
            this._selectedKeys.add(key)
        }
        this._buildAbilities()
    }

    _showAbilityTip(meta, cellX, cellY) {
        const desc = meta.description ? `\n${meta.description}` : ""
        this._tooltip.setText(`${meta.name}${desc}`)
        this._tooltip.setPosition(cellX + CELL + 6, cellY)
        this._tooltip.setVisible(true)
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

    _confirm() {
        // Persist the remaining vault (loadout items leave the vault now)
        // and stash the loadout on the dungeon singleton for World.create
        // to consume during world setup.
        const remainingRecords = this._vault.map(serialize).filter(Boolean)
        account.setVault(remainingRecords)
        dungeon.pendingLoadout = this._loadout.slice()
        // Picker selection (§14 B4) → applyAccountBook reads this. null when nothing
        // is banked so the whole-book default path still runs.
        dungeon.pendingAbilities = this._banked.length ? [...this._selectedKeys] : null
        router.bind(this)
        router.closeLoadout()
        router.startGame()
    }

    _skip() {
        // Vault unchanged; class defaults will be used. Abilities fall back to the
        // whole-book default (apply-as-many-as-fit).
        dungeon.pendingLoadout = null
        dungeon.pendingAbilities = null
        router.bind(this)
        router.closeLoadout()
        router.startGame()
    }

    _makeButton(x, y, label, onClick, textColor = COLOR_PRIMARY) {
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
