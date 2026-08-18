import Phaser from 'phaser'
import account from '../Account.js'
import router from '../SceneRouter.js'

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
const COLOR_DANGER = "#fca5a5"

const MIN_NAME = 3
const MAX_NAME = 16
const NAME_REGEX = /^[a-zA-Z0-9]$/

export default class Profile extends Phaser.Scene {
    constructor() {
        super({ key: "profile-scene", active: false })
    }

    create() {
        this._mode = "view"
        this._renameBuffer = ""
        this._confirmingReset = false

        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.85).setOrigin(0)

        const cx = GAME_W / 2

        this.add.text(cx, 60, "Profile", {
            font: "60px Arial",
            color: COLOR_ACCENT
        }).setOrigin(0.5)

        this._renderBody(cx)

        this.input.keyboard.on("keyup", (event) => this._onKey(event))
    }

    _renderBody(cx) {
        // Clear any stale body widgets so we can re-render after rename/reset.
        if (this._body) this._body.forEach(w => w.destroy())
        this._body = []

        const data = account.load() || {}
        const username = data.username || "(unnamed)"
        const created = data.createdAt ? data.createdAt.slice(0, 10) : null

        const add = (...args) => {
            const w = this.add.text(...args)
            this._body.push(w)
            return w
        }
        const addRect = (...args) => {
            const w = this.add.rectangle(...args)
            this._body.push(w)
            return w
        }

        add(cx, 140, username, { font: "28px Arial", color: COLOR_PRIMARY }).setOrigin(0.5)
        if (created) {
            add(cx, 168, `Joined ${created}`, { font: "13px Arial", color: COLOR_DIM }).setOrigin(0.5)
        }

        // Personal best
        add(cx, 210, "PERSONAL BEST", { font: "13px Arial", color: COLOR_DIM }).setOrigin(0.5)
        add(cx, 232, `Score ${data.bestScore || 0}    Floor ${data.bestFloor || 0}`, {
            font: "16px Arial", color: COLOR_PRIMARY
        }).setOrigin(0.5)

        // Lifetime stats
        add(cx, 280, "LIFETIME", { font: "13px Arial", color: COLOR_DIM }).setOrigin(0.5)
        const labelX = cx - 120
        const valueX = cx + 120
        const vaultCount = Array.isArray(data.vault) ? data.vault.length : 0
        const rows = [
            ["Runs played", data.runsAttempted || 0],
            ["Runs completed", data.runsCompleted || 0],
            ["Coins", data.lifetimeCoins || 0],
            ["Keys", data.lifetimeKeys || 0],
            ["Vault", `${vaultCount}/${account.vaultCapacity()}`]
        ]
        rows.forEach(([label, val], i) => {
            const y = 308 + i * 24
            add(labelX, y, label, { font: "16px Arial", color: COLOR_DIM }).setOrigin(0, 0.5)
            add(valueX, y, String(val), { font: "16px Arial", color: COLOR_PRIMARY }).setOrigin(1, 0.5)
        })

        // Mode-dependent footer
        if (this._mode === "rename") {
            this._renderRenameInput(cx, addRect, add)
        } else if (this._confirmingReset) {
            this._renderResetConfirm(cx, addRect, add)
        } else if (this._confirmingClearVault) {
            this._renderClearVaultConfirm(cx, addRect, add)
        } else {
            this._renderActions(cx, addRect, add)
        }
    }

    _renderActions(cx, addRect, add) {
        const y = 470
        this._makeButton(cx - 240, y, "Rename", () => this._enterRename(), addRect, add)
        this._makeButton(cx - 80, y, "Clear Vault", () => this._enterClearVaultConfirm(), addRect, add, COLOR_DANGER)
        this._makeButton(cx + 80, y, "Reset", () => this._enterResetConfirm(), addRect, add, COLOR_DANGER)
        this._makeButton(cx + 240, y, "Back", () => this._close(), addRect, add)
        add(cx, GAME_H - 36, "Press Esc to go back", {
            font: "13px Arial", color: COLOR_DIM
        }).setOrigin(0.5)
    }

    _renderClearVaultConfirm(cx, addRect, add) {
        add(cx, 440, "Clear vault?", { font: "20px Arial", color: COLOR_DANGER }).setOrigin(0.5)
        add(cx, 466, "All stored items are discarded. Lifetime stats are kept.", {
            font: "13px Arial", color: COLOR_DIM
        }).setOrigin(0.5)
        this._makeButton(cx - 90, 504, "Yes, clear", () => this._doClearVault(), addRect, add, COLOR_DANGER)
        this._makeButton(cx + 90, 504, "Cancel", () => this._cancelClearVaultConfirm(), addRect, add)
    }

    _renderRenameInput(cx, addRect, add) {
        add(cx, 440, "Enter a new name", { font: "16px Arial", color: COLOR_PRIMARY }).setOrigin(0.5)
        add(cx, 460, `(${MIN_NAME}-${MAX_NAME} chars, letters and numbers)`, {
            font: "12px Arial", color: COLOR_DIM
        }).setOrigin(0.5)
        addRect(cx, 488, 320, 36, 0x000000, 0.4).setStrokeStyle(2, 0xcfc6b8)
        this._renameDisplay = add(cx, 488, this._renameBuffer + "_", {
            font: "20px Arial", color: COLOR_PRIMARY
        }).setOrigin(0.5)
        this._body.push(this._renameDisplay)
        add(cx, 526, "Enter to confirm  •  Esc to cancel", {
            font: "12px Arial", color: COLOR_DIM
        }).setOrigin(0.5)
    }

    _renderResetConfirm(cx, addRect, add) {
        add(cx, 440, "Reset profile?", { font: "20px Arial", color: COLOR_DANGER }).setOrigin(0.5)
        add(cx, 466, "This wipes username and lifetime stats. Cannot be undone.", {
            font: "13px Arial", color: COLOR_DIM
        }).setOrigin(0.5)
        this._makeButton(cx - 90, 504, "Yes, reset", () => this._doReset(), addRect, add, COLOR_DANGER)
        this._makeButton(cx + 90, 504, "Cancel", () => this._cancelResetConfirm(), addRect, add)
    }

    _onKey(event) {
        if (this._mode === "rename") {
            if (event.key === "Escape") {
                this._exitRename()
                return
            }
            if (event.key === "Enter") {
                if (this._renameBuffer.length >= MIN_NAME) {
                    account.setUsername(this._renameBuffer)
                    this._exitRename()
                }
                return
            }
            if (event.key === "Backspace") {
                this._renameBuffer = this._renameBuffer.slice(0, -1)
            } else if (NAME_REGEX.test(event.key) && this._renameBuffer.length < MAX_NAME) {
                this._renameBuffer += event.key
            }
            if (this._renameDisplay) this._renameDisplay.setText(this._renameBuffer + "_")
            return
        }

        if (this._confirmingReset) {
            if (event.key === "Escape") this._cancelResetConfirm()
            return
        }

        if (this._confirmingClearVault) {
            if (event.key === "Escape") this._cancelClearVaultConfirm()
            return
        }

        if (event.key === "Escape") this._close()
    }

    _enterClearVaultConfirm() {
        this._confirmingClearVault = true
        this._renderBody(GAME_W / 2)
    }

    _cancelClearVaultConfirm() {
        this._confirmingClearVault = false
        this._renderBody(GAME_W / 2)
    }

    _doClearVault() {
        account.clearVault()
        this._confirmingClearVault = false
        this._renderBody(GAME_W / 2)
    }

    _enterRename() {
        this._mode = "rename"
        this._renameBuffer = ""
        this._renderBody(GAME_W / 2)
    }

    _exitRename() {
        this._mode = "view"
        this._renderBody(GAME_W / 2)
    }

    _enterResetConfirm() {
        this._confirmingReset = true
        this._renderBody(GAME_W / 2)
    }

    _cancelResetConfirm() {
        this._confirmingReset = false
        this._renderBody(GAME_W / 2)
    }

    _doReset() {
        account.clearProfile()
        // Wipe puts the player in a no-username state. Easiest path back to a
        // sane setup is the menu, where Intro re-runs name entry.
        this._confirmingReset = false
        router.bind(this)
        router.toMenu()
    }

    _close() {
        router.bind(this)
        router.closeProfile()
    }

    _makeButton(x, y, label, onClick, addRect, add, textColor = COLOR_PRIMARY) {
        const w = 140
        const h = 32
        const rect = addRect(x, y, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        add(x, y, label, { font: "16px Arial", color: textColor }).setOrigin(0.5)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", onClick)
    }
}
