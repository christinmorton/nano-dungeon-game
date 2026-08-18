import Phaser from 'phaser'
import dungeon from '../Dungeon.js'
import run from '../Run.js'
import router from '../SceneRouter.js'
import gameLog from '../GameLog.js'

// Milestone ability draft (§14 B5/B6). A modal pick-a-reward screen opened by
// World.create when run.pendingDraft is staged (set in Run.goDown on reaching a new
// deepest floor). Offers a hybrid set (curated class-role picks + a wildcard) built
// by abilities/draft.js. Picking ACQUIRES the ability via hero.learnAbility (so it
// banks on extraction and equips now if a bar slot is free); Skip declines.

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
const COLOR_OK = "#86efac"

export default class DraftScreen extends Phaser.Scene {
    constructor() {
        super({ key: "draft-scene", active: false })
    }

    create() {
        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.94).setOrigin(0)
        const cx = GAME_W / 2
        // Shared modal — the affinity passive draft (§18 rare essence) reuses the same
        // scene/cards as the milestone ability draft, branching on which is staged.
        if (run.pendingPassiveDraft) { this._createPassiveDraft(cx, run.pendingPassiveDraft); return }
        this._createAbilityDraft(cx)
    }

    _createAbilityDraft(cx) {
        this.add.text(cx, 60, "A New Technique", { font: "44px Arial", color: COLOR_ACCENT }).setOrigin(0.5)
        this.add.text(cx, 104, "Milestone reward — choose one to learn. (Adds to your collection; equips now if you have a free slot.)", {
            font: "14px Arial", color: COLOR_DIM
        }).setOrigin(0.5)

        const options = run.pendingDraft || []
        if (!options.length) {
            this.add.text(cx, 210, "Nothing new to learn right now.", { font: "16px Arial", color: COLOR_DIM }).setOrigin(0.5)
        }
        const y = this._renderOptionCards(cx, 170, options, (opt) => this._take(opt))
        this._makeButton(cx, y + 24, "Skip", () => this._skip(), COLOR_DIM)
    }

    _createPassiveDraft(cx, draft) {
        this.add.text(cx, 60, "Arcane Resonance", { font: "44px Arial", color: COLOR_ACCENT }).setOrigin(0.5)
        this.add.text(cx, 104, "The pure essence offers a choice — claim one gift of your affinity.", {
            font: "14px Arial", color: COLOR_DIM
        }).setOrigin(0.5)

        const options = draft.options || []
        const y = this._renderOptionCards(cx, 170, options, (opt) => this._takePassive(opt))
        this._makeButton(cx, y + 24, "Take a random gift", () => this._takePassive(options[Math.floor(Math.random() * options.length)]), COLOR_DIM)
    }

    // Shared card list. `onTake(opt)` fires when a card is clicked. Returns the y
    // after the last card so the caller can place its button.
    _renderOptionCards(cx, yStart, options, onTake) {
        const cardW = 720
        const cardH = 96
        const gap = 16
        let y = yStart
        for (const opt of options) {
            const x = cx - cardW / 2
            const card = this.add.rectangle(x, y, cardW, cardH, 0x1f1f1f, 0.95).setOrigin(0).setStrokeStyle(1, 0x4a4a4a)
            card.setInteractive({ useHandCursor: true })
            card.on("pointerover", () => card.setStrokeStyle(2, 0x86efac))
            card.on("pointerout", () => card.setStrokeStyle(1, 0x4a4a4a))
            card.on("pointerup", () => onTake(opt))

            this.add.image(x + 48, y + cardH / 2, "tiles", opt.icon).setScale(2.5)
            this.add.text(x + 96, y + 22, opt.name, { font: "20px Arial", color: COLOR_PRIMARY }).setOrigin(0, 0.5)
            this.add.text(x + 96, y + 58, opt.description || "", {
                font: "13px Arial", color: COLOR_DIM, wordWrap: { width: cardW - 230 }
            }).setOrigin(0, 0.5)
            this.add.text(x + cardW - 70, y + cardH / 2, "Take ›", { font: "16px Arial", color: COLOR_OK }).setOrigin(0.5)

            y += cardH + gap
        }
        return y
    }

    _take(opt) {
        const result = dungeon.player?.learnAbility?.(opt.key)
        if (result?.ok) {
            const tail = result.equipped ? "" : " (added to your collection — equip it next run)"
            gameLog.log(`Learned ${result.name}!${tail}`)
        }
        this._finish()
    }

    _skip() {
        gameLog.log("You pass on the milestone reward.")
        this._finish()
    }

    // Rare-essence passive draft (§18): apply the chosen pool passive to the basic slot.
    _takePassive(opt) {
        if (opt?.PassiveClass) {
            dungeon.player?.setBasicPassive?.(opt.PassiveClass)
            gameLog.log(`The essence awakens ${opt.name}.`)
        }
        this._finishPassive()
    }

    _finishPassive() {
        run.pendingPassiveDraft = null
        router.bind(this)
        router.closeDraft()
        dungeon.player?.refreshUI?.()
    }

    _finish() {
        run.pendingDraft = null
        router.bind(this)
        router.closeDraft()
        dungeon.player?.refreshUI?.()
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
