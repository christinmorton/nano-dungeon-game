import Phaser from 'phaser'
import dungeon from '../Dungeon.js'
import router from '../SceneRouter.js'
import prefs from '../Prefs.js'
import audio from '../Audio.js'
import { addEntityIcon } from '../assetLoader.js'
import { SLOT_NAMES } from '../items/GenericItem.js'

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

        // Modal frame. Grew by one button row (34px) when Character was added.
        this.add.rectangle(cx, cy + 17, 360, 418, 0x1a1a1a).setStrokeStyle(2, 0x4a4a4a)

        this.add.text(cx, cy - 152, "Paused", {
            font: "36px Arial",
            color: "#cfc6b8"
        }).setOrigin(0.5)

        this.add.text(cx, cy - 118, "Press Esc to resume", {
            font: "13px Arial",
            color: "#7a7466"
        }).setOrigin(0.5)

        // Four 32px-tall buttons at a 34px pitch; everything below shifted by
        // one row when Character was added (2026-10-03).
        this._makeButton(cx, cy - 94, "Resume", () => this._resume())
        this._makeButton(cx, cy - 60, "Character", () => {
            router.bind(this)
            router.openCharacter()
        })
        this._makeButton(cx, cy - 26, "Log", () => {
            router.bind(this)
            router.openLog()
        })
        this._makeButton(cx, cy + 8, "Controls", () => {
            router.bind(this)
            router.openControls()
        })
        // v3 also offered Profile, Settings, Credits and Quit to Menu here. Every
        // one routes through SceneRouter to a scene v5 does not register, so the
        // buttons would have looked live and silently done nothing. They come back
        // when their screens do, not before.

        // Volume. Lives here rather than behind a Settings screen because there
        // is no Settings screen, and a browser game that cannot be turned down
        // is a browser game people close. Stepping a channel to 0% is the mute.
        this._makeVolumeRow(cx, cy + 38, "Music", "musicVolume")
        this._makeVolumeRow(cx, cy + 64, "Sound", "sfxVolume")

        this._drawInventory(cx, cy + 90)

        this.input.keyboard.on("keyup", (event) => {
            if (event.key !== "Escape") return
            // If a deeper overlay is layered above us, let it own Escape —
            // closing pause from underneath would dismiss both at once.
            if (this.scene.isActive("character-scene")) return
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
        // Read the slot order from the items module rather than repeating it. The
        // two lists were identical, which is exactly how they drift: adding a slot
        // to SLOT_NAMES would have silently hidden it from this panel.
        const slots = player.inventory.equippedSlots
        const rowH = 22

        SLOT_NAMES.forEach((name, i) => {
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
                // Click the row to unequip. Goes through hero.unequipSlot (the same
                // verb the M/O/H/B/A keys use) rather than the inventory directly,
                // so carry-full falls back to the bag-on-drop path for free.
                this._makeRowHitArea(rowY, rowH, "Click to unequip", () => {
                    player.unequipSlot(name)
                    this._renderActiveTab()
                })
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
        const player = dungeon.player
        const carry = player?.items || []
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
            const count = player.inventory.stackCountOf(item)
            const label = this.add.text(iconX + 22, rowY, count > 1 ? `${item.name}  x${count}` : item.name, {
                font: "12px Arial",
                color: "#cfc6b8"
            }).setOrigin(0, 0.5)
            this._panelBody.push(label)

            // A carried item has two possible actions, so the row cannot be one
            // hit area like the equipped page. Equip/Use on the left, Drop on the
            // right. The verb reads "Equip" for anything with a slot and "Use" for
            // consumables — hero.toggleItem already branches on exactly that, so
            // the label names what the existing call will do.
            //
            // USE WORKS FROM HERE AS OF 2026-09-20. It previously could not: every
            // consumable ran its effect inside playCast's onComplete, a tween on
            // the World scene that never advances while this menu is over it, so
            // the potion would log and heal nothing until the player resumed. The
            // consumables now resolve synchronously and the cast pulse is purely
            // cosmetic.
            //
            // Indices are re-read at click time, not captured: the list shifts under
            // us on every equip, use and drop, so a stale `i` would act on whatever
            // slid into that row.
            this._makeRowButton(cx + 52, rowY, item.slot ? "Equip" : "Use", () => {
                const index = player.items.indexOf(item)
                if (index === -1) return
                player.toggleItem(index)
                this._renderActiveTab()
            })
            this._makeRowButton(cx + 116, rowY, "Drop", () => {
                const index = player.items.indexOf(item)
                if (index === -1) return
                player.dropItem(index)
                this._renderActiveTab()
            })
        })
    }

    // A full-width invisible strip over one row of the equipped page, so the whole
    // row is the target rather than just the text. Tinted on hover with a hint of
    // what clicking does, because nothing else on the panel had ever been clickable
    // and a row that only responds when hovered is not discoverable otherwise.
    _makeRowHitArea(rowY, rowH, hint, onClick) {
        const { cx } = this._panelBodyOrigin
        const w = 340
        const strip = this.add.rectangle(cx, rowY, w, rowH, 0xffffff, 0)
            .setInteractive({ useHandCursor: true })
        const hintText = this.add.text(cx + 158, rowY, hint, {
            font: "10px Arial",
            color: "#7a7466"
        }).setOrigin(1, 0.5).setAlpha(0)

        strip.on("pointerover", () => {
            strip.setFillStyle(0xffffff, 0.07)
            hintText.setAlpha(1)
        })
        strip.on("pointerout", () => {
            strip.setFillStyle(0xffffff, 0)
            hintText.setAlpha(0)
        })
        strip.on("pointerup", onClick)

        this._panelBody.push(strip, hintText)
        return strip
    }

    // One small labelled button sitting on a carry row.
    _makeRowButton(x, y, label, onClick) {
        const w = 54
        const h = 15
        const rect = this.add.rectangle(x, y, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        const text = this.add.text(x, y, label, {
            font: "10px Arial",
            color: "#cfc6b8"
        }).setOrigin(0.5)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", onClick)
        this._panelBody.push(rect, text)
        return rect
    }

    // One volume channel: label, a minus/plus pair, and the current percentage.
    // Steps of 10% clamped to 0..1. Changes apply immediately — refreshVolume
    // retunes a track that is already looping rather than waiting for the next
    // floor, and a channel dropped to 0 stops it outright.
    _makeVolumeRow(cx, y, label, prefKey) {
        const STEP = 0.1

        this.add.text(cx - 150, y, label, {
            font: "13px Arial",
            color: "#cfc6b8"
        }).setOrigin(0, 0.5)

        const value = this.add.text(cx + 72, y, "", {
            font: "13px Arial",
            color: "#facc15"
        }).setOrigin(0.5)

        const render = () => {
            const v = prefs.getPreferences()[prefKey] ?? 0
            value.setText(`${Math.round(v * 100)}%`)
        }

        const nudge = (delta) => {
            const current = prefs.getPreferences()[prefKey] ?? 0
            // Rounded to the step so repeated clicks can't drift onto values
            // like 0.30000000000000004 and render as "30%" while storing junk.
            const next = Math.round(Math.min(1, Math.max(0, current + delta)) * 10) / 10
            prefs.setPreference(prefKey, next)
            audio.refreshVolume()
            render()
        }

        this._makeStepper(cx + 30, y, "-", () => nudge(-STEP))
        this._makeStepper(cx + 114, y, "+", () => nudge(STEP))
        render()
    }

    _makeStepper(x, y, label, onClick) {
        const rect = this.add.rectangle(x, y, 24, 22, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        this.add.text(x, y, label, { font: "14px Arial", color: "#cfc6b8" }).setOrigin(0.5)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", onClick)
        return rect
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
