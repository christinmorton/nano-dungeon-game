import Phaser from 'phaser'
import dungeon from '../Dungeon.js'
import router from '../SceneRouter.js'
import { addEntityIcon } from '../assetLoader.js'

const GAME_W = 80 * 16
const GAME_H = 50 * 16

export default class Pause extends Phaser.Scene {
    constructor() {
        super({ key: "pause-scene", active: false })
    }

    create() {
        dungeon.paused = true

        // Dim full-screen overlay
        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0)

        const cx = GAME_W / 2
        const cy = (GAME_H - 160) / 2

        // Modal frame
        this.add.rectangle(cx, cy, 360, 384, 0x1a1a1a).setStrokeStyle(2, 0x4a4a4a)

        this.add.text(cx, cy - 152, "Paused", {
            font: "36px Arial",
            color: "#cfc6b8"
        }).setOrigin(0.5)

        this.add.text(cx, cy - 110, "Press Esc to resume", {
            font: "13px Arial",
            color: "#7a7466"
        }).setOrigin(0.5)

        this._makeButton(cx, cy - 72, "Resume", () => this._resume())
        this._makeButton(cx, cy - 30, "Profile", () => {
            router.bind(this)
            router.openProfile()
        })
        this._makeButton(cx, cy + 12, "Log", () => {
            router.bind(this)
            router.openLog()
        })
        this._makeButton(cx, cy + 54, "Settings", () => {
            router.bind(this)
            router.openSettings()
        })
        this._makeButton(cx, cy + 96, "Credits", () => {
            router.bind(this)
            router.openCredits()
        })
        this._makeButton(cx, cy + 138, "Quit to Menu", () => {
            dungeon.paused = false
            router.bind(this)
            router.toMenu()
        })

        this._drawInventory(cx, cy + 212)

        this.input.keyboard.on("keyup", (event) => {
            if (event.key !== "Escape") return
            // If a deeper overlay is layered above us, let it own Escape —
            // closing pause from underneath would dismiss both at once.
            if (this.scene.isActive("credits-scene")) return
            if (this.scene.isActive("profile-scene")) return
            if (this.scene.isActive("settings-scene")) return
            if (this.scene.isActive("controls-scene")) return
            if (this.scene.isActive("log-scene")) return
            this._resume()
        })
    }

    _resume() {
        dungeon.paused = false
        router.bind(this)
        router.closePause()
    }

    _drawInventory(cx, topY) {
        const player = dungeon.player
        if (!player) return

        // Fixed-height panel hosting two tabbed pages. Tabs are clickable
        // strips at the top; the body below redraws when the active tab
        // changes. _panelBody tracks the page's GameObjects so a tab switch
        // can wipe and rebuild.
        this._activeTab = 'equipped'
        this._panelBody = []

        const panelW = 360
        const panelH = 220
        const tabH = 26
        const panelLeft = cx - panelW / 2
        const panelTop = topY

        this.add.rectangle(cx, panelTop + panelH / 2, panelW, panelH, 0x1a1a1a)
            .setStrokeStyle(2, 0x4a4a4a)

        const equippedTab = this._makeTab(
            panelLeft + panelW / 4, panelTop + tabH / 2,
            panelW / 2, tabH, "Equipped",
            () => this._setTab('equipped')
        )
        const carryTab = this._makeTab(
            panelLeft + (panelW * 3) / 4, panelTop + tabH / 2,
            panelW / 2, tabH, "Carry",
            () => this._setTab('carry')
        )
        this._tabs = { equipped: equippedTab, carry: carryTab }

        this._panelBodyOrigin = {
            cx,
            top: panelTop + tabH + 6,
            bottom: panelTop + panelH - 6,
            iconX: cx - 150
        }

        this._renderActiveTab()
    }

    _makeTab(cx, cy, w, h, label, onClick) {
        const rect = this.add.rectangle(cx, cy, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        const text = this.add.text(cx, cy, label, {
            font: "13px Arial",
            color: "#cfc6b8"
        }).setOrigin(0.5)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerup", onClick)
        return { rect, text }
    }

    _setTab(tabName) {
        if (this._activeTab === tabName) return
        this._activeTab = tabName
        this._renderActiveTab()
    }

    _renderActiveTab() {
        // Highlight the active tab; dim the other.
        for (const [name, tab] of Object.entries(this._tabs)) {
            const active = name === this._activeTab
            tab.rect.setFillStyle(active ? 0x3a3a3a : 0x2a2a2a)
            tab.text.setColor(active ? "#facc15" : "#cfc6b8")
        }

        // Tear down the previous page body.
        for (const obj of this._panelBody) obj.destroy()
        this._panelBody = []

        if (this._activeTab === 'equipped') {
            this._renderEquippedPage()
        } else {
            this._renderCarryPage()
        }
    }

    _renderEquippedPage() {
        const { cx, top, iconX } = this._panelBodyOrigin
        const player = dungeon.player
        const slotOrder = ['mainhand', 'offhand', 'head', 'body', 'feet', 'gloves', 'accessory']
        const slots = player.inventory.equippedSlots
        const rowH = 22

        slotOrder.forEach((name, i) => {
            const item = slots[name]
            const rowY = top + i * rowH + rowH / 2
            if (item) {
                const icon = addEntityIcon(this, iconX, rowY, item, { display: 16, originX: 0, originY: 0.5, tintFill: true })
                this._panelBody.push(icon)
                const label = this.add.text(iconX + 22, rowY, `${item.name}  [${name}]`, {
                    font: "12px Arial",
                    color: "#facc15"
                }).setOrigin(0, 0.5)
                this._panelBody.push(label)
            } else {
                const label = this.add.text(iconX + 22, rowY, `(empty)  [${name}]`, {
                    font: "12px Arial",
                    color: "#7a7466"
                }).setOrigin(0, 0.5)
                this._panelBody.push(label)
            }
        })
    }

    _renderCarryPage() {
        const { cx, top, iconX } = this._panelBodyOrigin
        const carry = dungeon.player?.items || []
        const rowH = 18

        if (carry.length === 0) {
            const label = this.add.text(cx, top + rowH, "(empty)", {
                font: "12px Arial",
                color: "#7a7466"
            }).setOrigin(0.5)
            this._panelBody.push(label)
            return
        }

        carry.forEach((item, i) => {
            const rowY = top + i * rowH + rowH / 2
            const icon = addEntityIcon(this, iconX, rowY, item, { display: 16, originX: 0, originY: 0.5, tintFill: true })
            this._panelBody.push(icon)
            const label = this.add.text(iconX + 22, rowY, item.name, {
                font: "12px Arial",
                color: "#cfc6b8"
            }).setOrigin(0, 0.5)
            this._panelBody.push(label)
        })
    }

    _makeButton(x, y, label, onClick) {
        const w = 220
        const h = 32
        const rect = this.add.rectangle(x, y, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        const text = this.add.text(x, y, label, { font: "16px Arial", color: "#cfc6b8" }).setOrigin(0.5)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", onClick)
        return { rect, text }
    }
}
