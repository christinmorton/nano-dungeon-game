import Phaser from 'phaser'
import router from '../SceneRouter.js'
import account from '../Account.js'

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
const COLOR_ON = "#4ade80"
const COLOR_OFF = "#7a7466"

export default class Settings extends Phaser.Scene {
    constructor() {
        super({ key: "settings-scene", active: false })
    }

    create() {
        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.85).setOrigin(0)

        const cx = GAME_W / 2

        this.add.text(cx, 60, "Settings", {
            font: "60px Arial",
            color: COLOR_ACCENT
        }).setOrigin(0.5)

        let y = 160

        // Run length — the headline pre-run choice: size the whole dungeon toward
        // a target session length (run-time budgeting). Given prime placement.
        this.add.text(cx, y, "RUN LENGTH", {
            font: "16px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(0.5)
        this._makePicker(
            cx, y + 36,
            "Length",
            ["1min", "3min", "5min", "7min", "free"],
            ["1m", "3m", "5m", "7m", "Free"],
            () => account.getPreferences().runLength,
            (next) => account.setPreference("runLength", next)
        )
        this.add.text(cx, y + 62, "Target total time across all 5 floors — shorter picks make smaller floors (great for a quick phone run); Free is the full-size dungeon. Applies on your next run.", {
            font: "12px Arial",
            color: COLOR_DIM,
            wordWrap: { width: 600, useAdvancedWrap: true },
            align: "center"
        }).setOrigin(0.5, 0)
        y += 100

        // Controls — opens the dedicated keybinds screen (handoff from Settings).
        this.add.text(cx, y, "CONTROLS", {
            font: "16px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(0.5)
        this._makeActionButton(cx, y + 40, "Configure controls", () => {
            router.bind(this)
            router.openControls()
        })
        y += 96

        // Display section — first interactive setting lives here.
        this.add.text(cx, y, "DISPLAY", {
            font: "16px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(0.5)

        this._makeToggle(
            cx, y + 36,
            "Show enemy perception zones",
            () => account.getPreferences().showPerceptionZones,
            (next) => account.setPreference("showPerceptionZones", next)
        )

        this._makeToggle(
            cx, y + 64,
            "Show fog of war",
            () => account.getPreferences().showFogOfWar,
            (next) => account.setPreference("showFogOfWar", next)
        )

        this._makePicker(
            cx, y + 100,
            "HUD position",
            ["bottom-left", "bottom-center", "bottom-right"],
            ["Left", "Center", "Right"],
            () => account.getPreferences().hudPosition,
            (next) => account.setPreference("hudPosition", next)
        )

        this.add.text(cx, y + 124, "HUD position applies on next floor transition.", {
            font: "12px Arial",
            color: COLOR_DIM,
            wordWrap: { width: 600 },
            align: "center"
        }).setOrigin(0.5, 0)

        this._makePicker(
            cx, y + 156,
            "Camera zoom",
            [2, 3],
            ["2x", "3x"],
            () => account.getPreferences().cameraZoom,
            (next) => account.setPreference("cameraZoom", next)
        )
        this.add.text(cx, y + 180, "Bigger tiles vs. more of the map on screen. Applies on the next floor transition.", {
            font: "12px Arial",
            color: COLOR_DIM,
            wordWrap: { width: 600 },
            align: "center"
        }).setOrigin(0.5, 0)

        // Gameplay section — tuning knobs that affect mechanics, separate
        // from the visual toggles above.
        y += 216
        this.add.text(cx, y, "GAMEPLAY", {
            font: "16px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(0.5)

        this._makeStepper(
            cx, y + 36,
            "Hero speed (SPD)",
            0.5, 5, 0.5,
            () => account.getPreferences().heroSpeed,
            (next) => account.setPreference("heroSpeed", next)
        )

        // Starting kit — lean "build your own" (one ability + ultimate, draft the
        // rest through the run) vs the classic full class kit (§14 lean-start).
        y += 84
        this.add.text(cx, y, "STARTING KIT", {
            font: "16px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(0.5)
        this._makePicker(
            cx, y + 36,
            "Kit",
            [false, true],
            ["Build", "Classic"],
            () => !!account.getPreferences().classicKit,
            (next) => account.setPreference("classicKit", next)
        )
        this.add.text(cx, y + 60, "Build: begin with one ability + your ultimate and draft the rest through the run. Classic: full class kit. Applies on your next run.", {
            font: "12px Arial",
            color: COLOR_DIM,
            wordWrap: { width: 600 },
            align: "center"
        }).setOrigin(0.5, 0)

        this._makeBackButton(cx, GAME_H - 80)

        this.add.text(cx, GAME_H - 36, "Press Esc or click Back", {
            font: "13px Arial",
            color: COLOR_DIM
        }).setOrigin(0.5)

        // Ignore Escape briefly after opening so a stray keyup — e.g. the same
        // Escape press that closed the Controls screen and handed back here —
        // doesn't immediately close Settings too. (A normal press outlasts a frame.)
        this._openedAt = Date.now()
        this.input.keyboard.on("keyup", (event) => {
            if (event.key !== "Escape") return
            if (Date.now() - this._openedAt < 300) return
            this._close()
        })
    }

    _close() {
        router.bind(this)
        router.closeSettings()
    }

    _makeToggle(x, y, label, getValue, setValue) {
        // Label sits left-of-center; toggle button sits right-of-center.
        const labelX = x - 30
        const toggleX = x + 160

        this.add.text(labelX, y, label, {
            font: "13px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(1, 0.5)

        const w = 60
        const h = 26
        const rect = this.add.rectangle(toggleX, y, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        const text = this.add.text(toggleX, y, "", {
            font: "13px Arial",
            color: COLOR_ON
        }).setOrigin(0.5)

        const render = () => {
            const on = !!getValue()
            text.setText(on ? "ON" : "OFF")
            text.setColor(on ? COLOR_ON : COLOR_OFF)
        }
        render()

        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", () => {
            setValue(!getValue())
            render()
        })
    }

    _makePicker(x, y, label, values, labels, getValue, setValue) {
        // Label right-aligned to the left of center; buttons in a row to the
        // right. Mirrors _makeToggle's layout so multiple controls line up.
        const labelX = x - 30
        this.add.text(labelX, y, label, {
            font: "13px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(1, 0.5)

        const baseX = x + 30
        const w = 70
        const h = 26
        const gap = 4
        const buttons = []

        const render = () => {
            const current = getValue()
            for (const b of buttons) {
                const on = b.value === current
                b.rect.setFillStyle(on ? 0x3a5a3a : 0x2a2a2a)
                b.text.setColor(on ? COLOR_ON : COLOR_OFF)
            }
        }

        values.forEach((value, i) => {
            const bx = baseX + i * (w + gap)
            const rect = this.add.rectangle(bx, y, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
            const text = this.add.text(bx, y, labels[i], { font: "12px Arial", color: COLOR_OFF }).setOrigin(0.5)
            rect.setInteractive({ useHandCursor: true })
            rect.on("pointerover", () => { if (getValue() !== value) rect.setFillStyle(0x3a3a3a) })
            rect.on("pointerout", () => { if (getValue() !== value) rect.setFillStyle(0x2a2a2a) })
            rect.on("pointerup", () => {
                setValue(value)
                render()
            })
            buttons.push({ rect, text, value })
        })

        render()
    }

    _makeStepper(x, y, label, min, max, step, getValue, setValue) {
        // Label left-of-center, then [−] [value] [+] to the right. Same
        // labelX as the toggles/picker so all four rows of controls line up.
        const labelX = x - 30
        const baseX = x + 30
        const btnSize = 26
        const valueWidth = 60

        this.add.text(labelX, y, label, {
            font: "13px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(1, 0.5)

        const minus = this.add.rectangle(baseX, y, btnSize, btnSize, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        this.add.text(baseX, y, "−", { font: "16px Arial", color: COLOR_PRIMARY }).setOrigin(0.5)

        const valueText = this.add.text(
            baseX + btnSize / 2 + valueWidth / 2,
            y,
            "",
            { font: "13px Arial", color: COLOR_ON }
        ).setOrigin(0.5)

        const plus = this.add.rectangle(
            baseX + btnSize + valueWidth,
            y,
            btnSize, btnSize, 0x2a2a2a
        ).setStrokeStyle(1, 0x4a4a4a)
        this.add.text(
            baseX + btnSize + valueWidth,
            y,
            "+",
            { font: "16px Arial", color: COLOR_PRIMARY }
        ).setOrigin(0.5)

        // Round to step so floating-point drift doesn't accumulate as the
        // user clicks (0.5 + 0.5 + ... can land on 2.0000000004 otherwise).
        const clamp = (v) => {
            const snapped = Math.round(v / step) * step
            const bounded = Math.max(min, Math.min(max, snapped))
            return Math.round(bounded * 1000) / 1000
        }

        const render = () => {
            const v = getValue() ?? 1
            valueText.setText(v.toFixed(1))
        }
        render()

        minus.setInteractive({ useHandCursor: true })
        minus.on("pointerover", () => minus.setFillStyle(0x3a3a3a))
        minus.on("pointerout", () => minus.setFillStyle(0x2a2a2a))
        minus.on("pointerup", () => {
            setValue(clamp((getValue() ?? 1) - step))
            render()
        })

        plus.setInteractive({ useHandCursor: true })
        plus.on("pointerover", () => plus.setFillStyle(0x3a3a3a))
        plus.on("pointerout", () => plus.setFillStyle(0x2a2a2a))
        plus.on("pointerup", () => {
            setValue(clamp((getValue() ?? 1) + step))
            render()
        })
    }

    _makeActionButton(x, y, label, onClick) {
        const w = 220
        const h = 32
        const rect = this.add.rectangle(x, y, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        this.add.text(x, y, label, { font: "14px Arial", color: COLOR_PRIMARY }).setOrigin(0.5)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", onClick)
    }

    _makeBackButton(x, y) {
        const w = 180
        const h = 36
        const rect = this.add.rectangle(x, y, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        this.add.text(x, y, "Back", { font: "16px Arial", color: COLOR_PRIMARY }).setOrigin(0.5)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", () => this._close())
    }
}
