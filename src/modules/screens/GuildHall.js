import Phaser from 'phaser'
import account from '../Account.js'
import dungeon from '../Dungeon.js'
import router from '../SceneRouter.js'

// The Guild Hall (documents/v3_hero_roster_and_account_progression.md §12, rebuild
// phase 6c): the home base. Shows the account level + roster capacity, the LIVING
// roster (embark to continue a hero), and the FALLEN wall (revive a hero with an
// Ember of Return token, slot permitting). Launched as an overlay from the Intro
// menu, like Profile. Continuing a hero routes straight into a run (its own saved
// kit is applied in Dungeon.placePlayer).

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
const COLOR_WIN = "#86efac"
const COLOR_DANGER = "#fca5a5"

const MAX_FALLEN_SHOWN = 6

// Display copy for a hero's motivation (mirrors Intro's MOTIVATION_UI adjectives).
const MOTIVATION_ADJ = {
    vengeance: "Vengeful", glory: "Glory-bound", redemption: "Repentant", greed: "Greedy",
    duty: "Dutiful", curiosity: "Curious", survival: "Wary", faith: "Faithful",
}

export default class GuildHall extends Phaser.Scene {
    constructor() {
        super({ key: "guild-hall-scene", active: false })
    }

    create() {
        this._status = ""
        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.9).setOrigin(0)
        this.add.text(GAME_W / 2, 48, "Guild Hall", { font: "56px Arial", color: COLOR_ACCENT }).setOrigin(0.5)
        this._render()
        this.input.keyboard.on("keyup", (e) => { if (e.key === "Escape") this._close() })
    }

    _render() {
        if (this._body) this._body.forEach(w => w.destroy())
        this._body = []

        const prog = account.accountProgress()
        const tokens = account.getReviveTokens()

        // --- Header: account level + roster capacity + embers -------------------
        const nextTxt = prog.atMaxLevel ? "max level" : `${prog.winsRemaining} win${prog.winsRemaining === 1 ? "" : "s"} to Lv ${prog.level + 1}`
        this._text(GAME_W / 2, 104,
            `Account Lv ${prog.level}   ·   Roster ${account.getCharacters().length}/${prog.rosterCap}   ·   Embers of Return: ${tokens}`,
            { font: "18px Arial", color: COLOR_PRIMARY }).setOrigin(0.5)
        this._text(GAME_W / 2, 128, nextTxt, { font: "13px Arial", color: COLOR_DIM }).setOrigin(0.5)

        // --- Two columns: LIVING roster (left) / FALLEN wall (right) ------------
        this._renderLiving(GAME_W * 0.27, 170)
        this._renderFallen(GAME_W * 0.73, 170, tokens)

        if (this._status) {
            this._text(GAME_W / 2, GAME_H - 74, this._status, { font: "15px Arial", color: COLOR_ACCENT }).setOrigin(0.5)
        }

        this._button(GAME_W / 2, GAME_H - 44, "Back", () => this._close())
        this._text(GAME_W / 2, GAME_H - 16, "Press Esc to go back", { font: "12px Arial", color: COLOR_DIM }).setOrigin(0.5)
    }

    _renderLiving(cx, top) {
        const living = account.getCharacters()
        this._text(cx, top, `HEROES  (${living.length}/${account.rosterCap()})`, { font: "14px Arial", color: COLOR_DIM }).setOrigin(0.5)

        if (!living.length) {
            this._text(cx, top + 40, "No heroes yet.", { font: "16px Arial", color: COLOR_DIM }).setOrigin(0.5)
            this._text(cx, top + 64, "Win a run and save your hero.", { font: "13px Arial", color: COLOR_DIM }).setOrigin(0.5)
            return
        }

        living.forEach((h, i) => {
            const y = top + 34 + i * 58
            this._text(cx, y, h.name, { font: "18px Arial", color: COLOR_PRIMARY }).setOrigin(0.5)
            const adj = MOTIVATION_ADJ[h.backstory?.motivation] || "Wandering"
            this._text(cx, y + 20, `Lv ${h.level} ${h.class}  ·  ${adj}  ·  ${h.learnedAbilities.length} abilities`,
                { font: "12px Arial", color: COLOR_DIM }).setOrigin(0.5)
            this._button(cx, y + 42, "Embark", () => this._embark(h), COLOR_WIN, 110, 26)
        })
    }

    _renderFallen(cx, top, tokens) {
        const fallen = account.getFallen()
        this._text(cx, top, `FALLEN  (${fallen.length})`, { font: "14px Arial", color: COLOR_DIM }).setOrigin(0.5)

        if (!fallen.length) {
            this._text(cx, top + 40, "None have fallen.", { font: "16px Arial", color: COLOR_DIM }).setOrigin(0.5)
            return
        }

        const canRevive = tokens > 0 && account.rosterSlotsFree() > 0
        fallen.slice(0, MAX_FALLEN_SHOWN).forEach((h, i) => {
            const y = top + 34 + i * 58
            const death = [...(h.history || [])].reverse().find(r => r.outcome === "death")
            const killedBy = death?.killedBy ? `fell to ${death.killedBy}` : "fell in the deep"
            this._text(cx, y, `† ${h.name}`, { font: "18px Arial", color: COLOR_DANGER }).setOrigin(0.5)
            this._text(cx, y + 20, `Lv ${h.level} ${h.class}  ·  ${killedBy}`, { font: "12px Arial", color: COLOR_DIM }).setOrigin(0.5)
            if (canRevive) {
                this._button(cx, y + 42, "Revive", () => this._revive(h), COLOR_ACCENT, 110, 26)
            }
        })
        if (fallen.length > MAX_FALLEN_SHOWN) {
            this._text(cx, top + 34 + MAX_FALLEN_SHOWN * 58, `…and ${fallen.length - MAX_FALLEN_SHOWN} more`,
                { font: "12px Arial", color: COLOR_DIM }).setOrigin(0.5)
        }
        if (fallen.length && !canRevive) {
            const why = tokens <= 0 ? "Need an Ember of Return to revive." : "Roster full — free a slot to revive."
            this._text(cx, top + 34 + Math.min(fallen.length, MAX_FALLEN_SHOWN) * 58 + 8, why,
                { font: "12px Arial", color: COLOR_DIM }).setOrigin(0.5)
        }
    }

    // Continue a living hero: carry it into a run as the in-flight Character. Its
    // saved kit is applied in Dungeon.placePlayer (see the `continue` spec). Skips
    // the Loadout item picker for now (a continued-hero loadout lands with 6d).
    _embark(hero) {
        dungeon.hero = hero.class
        dungeon.pendingCharacterSpec = { continue: hero }
        router.bind(this)
        router.closeGuildHall()
        router.startGame()
    }

    _revive(hero) {
        const result = account.reviveHero(hero.id)
        this._status = result.ok
            ? `${hero.name} is called back from the dark.`
            : result.reason === "no-token" ? "You have no Ember of Return."
            : result.reason === "no-slot" ? "Roster full — free a slot first."
            : "That hero can no longer be reached."
        this._render()
    }

    _close() {
        router.bind(this)
        router.closeGuildHall()
    }

    _text(...args) {
        const w = this.add.text(...args)
        this._body.push(w)
        return w
    }

    _button(x, y, label, onClick, color = COLOR_PRIMARY, w = 150, h = 30) {
        const rect = this.add.rectangle(x, y, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        const txt = this.add.text(x, y, label, { font: "15px Arial", color }).setOrigin(0.5)
        this._body.push(rect, txt)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", onClick)
        return rect
    }
}
