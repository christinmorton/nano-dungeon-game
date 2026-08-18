import Phaser from 'phaser'
import router from '../SceneRouter.js'
import dungeon from '../Dungeon.js'
import inputMap, { tokenFor } from '../InputMap.js'

// Keybind configuration screen. A full handoff from Settings (see
// SceneRouter.openControls): only one of the two is active at a time, so this
// scene owns Escape outright and there's no multi-scene race.
//
// Each row rebinds one action: click the key button → "press a key…" capture
// mode → the next key press sets the binding (live immediately via InputMap;
// persisted to Account). Conflicts and reserved keys are rejected.

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
const COLOR_GOLD = "#ffcc66"
const COLOR_ON = "#4ade80"
const COLOR_BAD = "#ef4444"

// Tokens the keymap can't claim: Escape (back/cancel), the item digits, the
// unequip letters (still hardcoded in HeroController), and modifier keys.
const RESERVED = new Set([
    'Escape', 'Tab', 'Shift', 'Control', 'Alt', 'Meta',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'm', 'o', 'h', 'b', 't', 'g', 'c',
])

// Human-readable label for a key token.
function keyLabel(token) {
    if (!token) return '—'
    if (token === 'Space') return 'Space'
    if (token.startsWith('Arrow')) return token.replace('Arrow', 'Arrow ')
    return token.length === 1 ? token.toUpperCase() : token
}

export default class Controls extends Phaser.Scene {
    constructor() {
        super({ key: "controls-scene", active: false })
    }

    create() {
        this._capture = null
        this._rows = []

        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.9).setOrigin(0)

        const cx = GAME_W / 2

        this.add.text(cx, 50, "Controls", { font: "52px Arial", color: COLOR_ACCENT }).setOrigin(0.5)
        this.add.text(cx, 100, "Click a key, then press the new key. Esc cancels.", {
            font: "13px Arial", color: COLOR_DIM
        }).setOrigin(0.5)

        // Abilities (slots come from the keymap; the last is the Ultimate).
        let y = 150
        this.add.text(cx, y, "ABILITIES", { font: "15px Arial", color: COLOR_PRIMARY }).setOrigin(0.5)
        y += 30
        const slots = inputMap.abilitySlotKeys.length
        const ultimate = inputMap.ultimateSlotIndex
        for (let i = 0; i < slots; i++) {
            const label = i === ultimate ? "Ultimate" : `Ability ${i + 1}`
            this._makeRow(
                cx, y, label, i === ultimate,
                () => inputMap.abilitySlotKeys[i],
                (token) => inputMap.rebindAbilitySlot(i, token),
                (owner) => owner.type === 'slot' && owner.index === i,
            )
            y += 36
        }

        // Discrete actions.
        y += 14
        this.add.text(cx, y, "ACTIONS", { font: "15px Arial", color: COLOR_PRIMARY }).setOrigin(0.5)
        y += 30
        const actions = [
            { id: 'interact', label: 'Interact' },
            { id: 'accept', label: 'Accept / Yes' },
            { id: 'decline', label: 'Decline / No' },
            { id: 'retreat', label: 'Retreat' },
            { id: 'passTurn', label: 'Pass turn' },
            { id: 'skillbook', label: 'Skillbook' },
            { id: 'beckon', label: 'Beckon ally' },
            { id: 'dismiss', label: 'Dismiss ally' },
        ]
        for (const a of actions) {
            this._makeRow(
                cx, y, a.label, false,
                () => inputMap.actions[a.id]?.[0],
                (token) => inputMap.rebind(a.id, [token]),
                (owner) => owner.type === 'action' && owner.action === a.id,
            )
            y += 36
        }

        // Movement is keymapped but not rebindable here yet (a later pass).
        y += 10
        this.add.text(cx, y, "Movement: Arrow keys  ·  Items: 1–0  (rebinding these comes later)", {
            font: "12px Arial", color: COLOR_DIM
        }).setOrigin(0.5)

        // Status line for save/conflict feedback.
        this._status = this.add.text(cx, y + 30, "", { font: "13px Arial", color: COLOR_ON }).setOrigin(0.5)

        // Reset + Back.
        this._makeButton(cx - 130, GAME_H - 70, "Reset to defaults", () => {
            inputMap.resetDefaults()
            inputMap.clearSaved()
            this._cancelCapture()
            this._renderAll()
            this._flash("Reset to defaults", COLOR_ON)
        }, 200)
        this._makeButton(cx + 110, GAME_H - 70, "Back", () => this._close(), 160)

        this.add.text(cx, GAME_H - 32, "Changes apply immediately; HUD labels refresh on the next floor.", {
            font: "12px Arial", color: COLOR_DIM
        }).setOrigin(0.5)

        // One keydown handler owns everything: capture a rebind, or Escape = back.
        this.input.keyboard.on("keydown", (event) => {
            if (this._capture) {
                const token = tokenFor(event)
                if (token === 'Escape') { this._cancelCapture(); return }
                this._applyCapture(token)
                return
            }
            if (event.key === "Escape") this._close()
        })
    }

    _close() {
        // Refresh the live HUD so the ability-bar hotkey labels reflect any
        // rebinds immediately when the player returns to the game (optional
        // chaining: no hero exists when Controls is opened from the Intro menu).
        dungeon.player?.hud?.refresh()
        router.bind(this)
        router.closeControls()
    }

    // --- rebind rows ---------------------------------------------------------

    _makeRow(cx, y, label, gold, getToken, apply, matchOwner) {
        const labelX = cx - 20
        const btnX = cx + 90
        this.add.text(labelX, y, label, {
            font: "14px Arial", color: gold ? COLOR_GOLD : COLOR_PRIMARY
        }).setOrigin(1, 0.5)

        const rect = this.add.rectangle(btnX, y, 150, 26, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        const text = this.add.text(btnX, y, "", { font: "13px Arial", color: COLOR_PRIMARY }).setOrigin(0.5)

        const row = { rect, text, getToken, apply, matchOwner }
        row.render = () => {
            if (this._capture === row) {
                text.setText("press a key…").setColor(COLOR_ACCENT)
            } else {
                text.setText(keyLabel(getToken())).setColor(COLOR_PRIMARY)
            }
        }
        row.render()

        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => { if (this._capture !== row) rect.setFillStyle(0x3a3a3a) })
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", () => this._startCapture(row))

        this._rows.push(row)
    }

    _startCapture(row) {
        this._cancelCapture()
        this._capture = row
        row.rect.setStrokeStyle(1, 0xfacc15)
        row.render()
        this._flash("Press a key…  (Esc to cancel)", COLOR_DIM)
    }

    _cancelCapture() {
        const row = this._capture
        this._capture = null
        if (row) { row.rect.setStrokeStyle(1, 0x4a4a4a); row.render() }
    }

    _applyCapture(token) {
        const row = this._capture
        if (!row || !token) return
        if (RESERVED.has(token)) {
            this._flash(`"${keyLabel(token)}" is reserved`, COLOR_BAD)
            this._cancelCapture()
            return
        }
        const owner = this._ownerOf(token)
        if (owner && !row.matchOwner(owner)) {
            this._flash(`"${keyLabel(token)}" is already in use`, COLOR_BAD)
            this._cancelCapture()
            return
        }
        row.apply(token)
        inputMap.persist()
        this._capture = null
        row.rect.setStrokeStyle(1, 0x4a4a4a)
        row.render()
        this._flash(`Bound to "${keyLabel(token)}"`, COLOR_ON)
    }

    // Which control currently owns a token, or null.
    _ownerOf(token) {
        const keys = inputMap.abilitySlotKeys
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] === token) return { type: 'slot', index: i }
        }
        for (const action in inputMap.actions) {
            if (inputMap.actions[action].includes(token)) return { type: 'action', action }
        }
        if (token in inputMap.movement) return { type: 'movement' }
        return null
    }

    _renderAll() {
        for (const row of this._rows) row.render()
    }

    _flash(msg, color) {
        this._status.setText(msg).setColor(color || COLOR_ON)
    }

    _makeButton(x, y, label, onClick, w = 180) {
        const rect = this.add.rectangle(x, y, w, 34, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        this.add.text(x, y, label, { font: "15px Arial", color: COLOR_PRIMARY }).setOrigin(0.5)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", onClick)
    }
}
