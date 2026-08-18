import Phaser from 'phaser'
import classes from '../Classes.js'
import dungeon from '../Dungeon.js'
import account from '../Account.js'
import router from '../SceneRouter.js'
import { MOTIVATIONS } from '../../data/character.js'

const MIN_NAME = 3
const MAX_NAME = 16
const NAME_REGEX = /^[a-zA-Z0-9]$/

// Display copy for the hero-creation motivation pick (rebuild phase 6a). Keyed by
// the schema MOTIVATIONS vocabulary. `adj` also flavors the auto-generated hero name
// until proper name entry / renaming lands with the Guild Hall (phase 6c).
const MOTIVATION_UI = {
    vengeance:  { adj: "Vengeful",    blurb: "driven by a grudge" },
    glory:      { adj: "Glory-bound", blurb: "hungry for legend" },
    redemption: { adj: "Repentant",   blurb: "seeking to atone" },
    greed:      { adj: "Greedy",      blurb: "in it for the gold" },
    duty:       { adj: "Dutiful",     blurb: "bound by the mission" },
    curiosity:  { adj: "Curious",     blurb: "chasing mysteries" },
    survival:   { adj: "Wary",        blurb: "just wants to live" },
    faith:      { adj: "Faithful",    blurb: "carried by the Light" },
}

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"

export default class Intro extends Phaser.Scene {
    constructor() {
        super({ key: "intro-scene", active: true })
    }

    create() {
        this._cx = this.cameras.main.width / 2
        this._cy = this.cameras.main.height / 2

        // Title is always present
        this.add.text(this._cx, this._cy - 240, "Nano Dungeon", {
            font: "96px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(0.5)

        this._mode = account.getUsername() ? "menu" : "name"
        this._nameBuffer = ""
        this._renderBody()

        this.input.keyboard.on("keyup", (event) => this._onKey(event))

        // If the user renames in the Profile overlay and comes back, refresh
        // the welcome line so it doesn't show the stale name.
        this.scene.get("profile-scene").events.on("shutdown", () => {
            if (this._mode === "menu") this._renderBody()
        })
    }

    // Re-renders the mid-screen body based on current mode. Wipes any prior
    // body widgets so we can flip between menu / hero-select cleanly without
    // each render leaking text objects.
    _renderBody() {
        if (this._body) this._body.forEach(w => w.destroy())
        this._body = []

        if (this._mode === "name") this._renderNameEntry()
        else if (this._mode === "menu") this._renderMenu()
        else if (this._mode === "hero") this._renderHeroSelect()
        else if (this._mode === "motivation") this._renderMotivationSelect()
    }

    _add(...args) {
        const w = this.add.text(...args)
        this._body.push(w)
        return w
    }

    _addRect(...args) {
        const w = this.add.rectangle(...args)
        this._body.push(w)
        return w
    }

    _renderNameEntry() {
        const x = this._cx
        const y = this._cy
        this._add(x, y - 60, "Enter your name", {
            font: "24px Arial", color: COLOR_PRIMARY
        }).setOrigin(0.5)
        this._add(x, y - 30, `(${MIN_NAME}-${MAX_NAME} chars, letters and numbers)`, {
            font: "16px Arial", color: COLOR_DIM
        }).setOrigin(0.5)
        this._addRect(x, y + 10, 320, 40, 0x000000, 0.3).setStrokeStyle(2, 0xcfc6b8)
        this._inputText = this._add(x, y + 10, this._nameBuffer + "_", {
            font: "24px Arial", color: COLOR_PRIMARY
        }).setOrigin(0.5)
        this._add(x, y + 80, "Press Enter to continue", {
            font: "16px Arial", color: COLOR_DIM
        }).setOrigin(0.5)
    }

    _renderMenu() {
        const x = this._cx
        const y = this._cy
        const username = account.getUsername()
        const best = account.getBest()

        this._add(x, y - 130, `Welcome, ${username}`, {
            font: "24px Arial", color: COLOR_PRIMARY
        }).setOrigin(0.5)

        if (best.score > 0) {
            this._add(x, y - 100, `Best: ${best.score} (floor ${best.floor})`, {
                font: "16px Arial", color: COLOR_DIM
            }).setOrigin(0.5)
        }

        this._makeButton(x, y - 72, "New Game", () => this._enterHeroSelect(), COLOR_ACCENT)
        this._makeButton(x, y - 28, "Guild Hall", () => {
            router.bind(this)
            router.openGuildHall()
        })
        this._makeButton(x, y + 16, "Profile", () => {
            router.bind(this)
            router.openProfile()
        })
        this._makeButton(x, y + 60, "Settings", () => {
            router.bind(this)
            router.openSettings()
        })
        this._makeButton(x, y + 104, "Credits", () => {
            router.bind(this)
            router.openCredits()
        })
    }

    _renderHeroSelect() {
        const x = this._cx
        const y = this._cy

        this._add(x, y - 130, "Choose your hero", {
            font: "24px Arial", color: COLOR_PRIMARY
        }).setOrigin(0.5)
        this._add(x, y - 100, "(press the number key)", {
            font: "13px Arial", color: COLOR_DIM
        }).setOrigin(0.5)

        const classNames = Object.keys(classes)
        classNames.forEach((name, i) => {
            this._add(x, y - 60 + (28 * i), `${i + 1} - ${name}`, {
                font: "20px Arial", color: COLOR_PRIMARY
            }).setOrigin(0.5)
        })

        this._makeButton(x, y + 100, "Back", () => this._enterMenu())
        this._add(x, y + 140, "Press Esc to go back", {
            font: "13px Arial", color: COLOR_DIM
        }).setOrigin(0.5)
    }

    // Hero-creation step 2 (rebuild phase 6a): what drives this hero. The chosen
    // motivation is stored on the Character's backstory and colours their in-run barks.
    _renderMotivationSelect() {
        const x = this._cx
        const y = this._cy

        this._add(x, y - 150, `What drives your ${this._pickedClass}?`, {
            font: "24px Arial", color: COLOR_PRIMARY
        }).setOrigin(0.5)
        this._add(x, y - 122, "(press the number key)", {
            font: "13px Arial", color: COLOR_DIM
        }).setOrigin(0.5)

        MOTIVATIONS.forEach((m, i) => {
            const ui = MOTIVATION_UI[m] || {}
            this._add(x, y - 90 + (26 * i), `${i + 1} - ${ui.adj || m}  —  ${ui.blurb || ""}`, {
                font: "18px Arial", color: COLOR_PRIMARY
            }).setOrigin(0.5)
        })

        this._makeButton(x, y + 140, "Back", () => { this._mode = "hero"; this._renderBody() })
        this._add(x, y + 178, "Press Esc to go back", {
            font: "13px Arial", color: COLOR_DIM
        }).setOrigin(0.5)
    }

    _onKey(event) {
        // Don't react if a child overlay (Profile / Credits) is layered on
        // top — they own input until dismissed.
        if (this._overlayActive()) return

        if (this._mode === "name") {
            this._handleNameInput(event)
            return
        }

        if (this._mode === "hero") {
            if (event.key === "Escape") {
                this._enterMenu()
                return
            }
            const key = event.key
            if (isNaN(Number(key))) return
            const classNames = Object.keys(classes)
            const hero = classNames[Number(key) - 1]
            if (!hero) return
            // Class picked → choose what DRIVES this hero (rebuild phase 6a), then
            // begin. The motivation seeds the hero's backstory + colours their barks.
            this._pickedClass = hero
            this._mode = "motivation"
            this._renderBody()
            return
        }

        if (this._mode === "motivation") {
            if (event.key === "Escape") {
                this._mode = "hero"
                this._renderBody()
                return
            }
            const key = event.key
            if (isNaN(Number(key))) return
            const motivation = MOTIVATIONS[Number(key) - 1]
            if (!motivation) return
            this._beginRun(this._pickedClass, motivation)
        }
    }

    // Establish the run's chosen hero (class + motivation) and proceed. The in-flight
    // Character itself is minted in Dungeon.placePlayer (after run.start(), which resets
    // run state) from this spec — see run.beginCharacter. Save-on-win / permadeath are
    // phase 6b; this only carries the choice into the run.
    _beginRun(className, motivation) {
        const ui = MOTIVATION_UI[motivation] || {}
        dungeon.hero = className
        dungeon.pendingCharacterSpec = {
            heroClass: className,
            name: `${ui.adj || "Wandering"} ${className}`,
            motivation,
        }
        router.bind(this)
        // Route through the Loadout overlay if there's anything to choose — vault
        // items OR account-banked abilities (§14 B4). Otherwise start directly.
        // Loadout's confirm/skip both call router.startGame().
        if (account.getVault().length > 0 || account.getLearnedAbilities().length > 0) {
            router.openLoadout()
        } else {
            router.startGame()
        }
    }

    _handleNameInput(event) {
        if (event.key === "Enter") {
            if (this._nameBuffer.length >= MIN_NAME) {
                account.setUsername(this._nameBuffer)
                this._mode = "menu"
                this._renderBody()
            }
            return
        }
        if (event.key === "Backspace") {
            this._nameBuffer = this._nameBuffer.slice(0, -1)
        } else if (NAME_REGEX.test(event.key) && this._nameBuffer.length < MAX_NAME) {
            this._nameBuffer += event.key
        }
        if (this._inputText) this._inputText.setText(this._nameBuffer + "_")
    }

    _overlayActive() {
        return this.scene.isActive("profile-scene")
            || this.scene.isActive("credits-scene")
            || this.scene.isActive("settings-scene")
            || this.scene.isActive("controls-scene")
            || this.scene.isActive("loadout-scene")
            || this.scene.isActive("guild-hall-scene")
    }

    _enterHeroSelect() {
        this._mode = "hero"
        this._renderBody()
    }

    _enterMenu() {
        this._mode = "menu"
        this._renderBody()
    }

    _makeButton(x, y, label, onClick, textColor = COLOR_PRIMARY) {
        const w = 240
        const h = 36
        const rect = this._addRect(x, y, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        this._add(x, y, label, { font: "18px Arial", color: textColor }).setOrigin(0.5)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", onClick)
    }
}
