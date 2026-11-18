import Phaser from 'phaser'
import dungeon from '../Dungeon.js'
import router from '../SceneRouter.js'
import inputMap from '../InputMap.js'
import audio from '../Audio.js'
import { addEntityIcon } from '../assetLoader.js'
import { SLOT_NAMES } from '../items/GenericItem.js'
import { STAT_NAMES } from '../classes/Stats.js'
import { heroSheet, equipDeltas, itemStatLine, deltaText, SHEET_ROWS } from '../items/compare.js'

// The Character screen — who you are, what you wear, and what each thing in
// your pack would change if you put it on. Opened and closed with the
// `character` key (default C) from the dungeon, or from the Pause menu.
//
// It exists because the game had no answer to "is this better?". A pack could
// hold three cuirasses and a legendary, and the only stats anywhere were prose
// in the hover tooltip; the hero's own attack, armor, dodge and block were
// computed in BaseHero and never shown. See items/compare.js for how the
// comparison is made (a simulated swap through the real stat reducer).
//
// Three columns: YOU (stats), EQUIPPED (click to unequip), PACK (Equip / Use /
// Drop, with the delta each item would make). The whole screen re-renders after
// every action, the way Shop does — the lists are short and the numbers in the
// left column change with every swap.
//
// Modal in the same way Shop is: SceneRouter.openCharacter PAUSES whatever
// opened it (World+UI, or Pause), because a covered Phaser scene still hears
// input, and resumes it on close.

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
const COLOR_BAD = "#e06c5a"
const COLOR_GOOD = "#7ed08a"
const COLOR_LEGENDARY = "#c9a0ff"

// Three columns across the 1280px design width.
const COL_YOU = { x: 60, w: 330 }
const COL_GEAR = { x: 430, w: 400 }
const COL_PACK = { x: 870, w: 360 }
const TOP = 176
const ITEM_ROW_H = 44

export default class Character extends Phaser.Scene {
    constructor() {
        super({ key: "character-scene", active: false })
    }

    create() {
        this._objs = []
        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.9).setOrigin(0)

        const cx = GAME_W / 2
        this.add.text(cx, 48, "Character", { font: "44px Arial", color: COLOR_ACCENT }).setOrigin(0.5)
        const key = inputMap.keyLabel('character')
        this.add.text(cx, 92, `Click gear to unequip, pack items to equip or use   ·   ${key} or Esc to close`, {
            font: "13px Arial", color: COLOR_DIM,
        }).setOrigin(0.5)

        this._render()

        // Same arming delay as Controls and Shop: the keyup that OPENED this
        // scene can still be in flight when the listener registers.
        this._armedAt = this.time.now + 150
        this.input.keyboard.on("keyup", (event) => {
            if (event.key === "Escape" || inputMap.actionForEvent(event) === 'character') this._close()
        })
    }

    _close() {
        if (this.time.now < this._armedAt) return
        router.bind(this)
        router.closeCharacter()
    }

    _render() {
        for (const o of this._objs) o.destroy()
        this._objs = []
        const hero = dungeon.player
        if (!hero) return
        this._renderYou(hero)
        this._renderEquipped(hero)
        this._renderPack(hero)
    }

    // --- YOU -----------------------------------------------------------------

    _renderYou(hero) {
        const { x, w } = COL_YOU
        let y = TOP
        this._header(x, y, w, "YOU")
        y += 34

        const className = hero.profile?.name || hero.name
        this._text(x, y, className, { font: "20px Arial", color: COLOR_ACCENT })
        y += 30
        this._text(x, y, `HP  ${Math.max(0, hero.healthPoints)} / ${hero.maxHealthPoints}`, { font: "14px Arial", color: COLOR_PRIMARY })
        this._text(x + w, y, `Coins  ${hero.tallies?.coins || 0}`, { font: "14px Arial", color: COLOR_PRIMARY }, 1)
        y += 34

        // Base stats, two per row. Read through hero.stat so a passive that
        // raises STR shows here the same as it does in combat.
        this._text(x, y, "STATS", { font: "bold 12px Arial", color: COLOR_DIM })
        y += 22
        for (let i = 0; i < STAT_NAMES.length; i += 2) {
            for (let j = 0; j < 2 && i + j < STAT_NAMES.length; j++) {
                const name = STAT_NAMES[i + j]
                const colX = x + j * (w / 2)
                this._text(colX, y, name, { font: "14px Arial", color: COLOR_PRIMARY })
                this._text(colX + 60, y, `${hero.stat(name)}`, { font: "14px Arial", color: COLOR_ACCENT })
            }
            y += 24
        }
        y += 10

        // Derived numbers — the "player power" block. These are the same values
        // Combat reads, so what the sheet says is what the next hit does.
        this._text(x, y, "COMBAT", { font: "bold 12px Arial", color: COLOR_DIM })
        y += 22
        const sheet = heroSheet(hero)
        const weapon = hero.currentWeapon?.()
        for (const row of SHEET_ROWS) {
            let value
            if (row.key === "attack") {
                const lo = Math.round(sheet.attackMin), hi = Math.round(sheet.attackMax)
                value = lo === hi ? `${lo}` : `${lo}–${hi}`
            } else {
                value = `${sheet[row.key]}${row.pct ? "%" : ""}`
            }
            this._text(x, y, row.label, { font: "14px Arial", color: COLOR_PRIMARY })
            this._text(x + 90, y, value, { font: "14px Arial", color: COLOR_ACCENT })
            let hint = row.hint || ""
            if (row.key === "attack") hint = weapon ? `with ${weapon.name}` : "unarmed"
            if (hint) this._text(x + 170, y + 2, hint, { font: "11px Arial", color: COLOR_DIM, wordWrap: { width: w - 170 } })
            y += 24
        }
    }

    // --- EQUIPPED ------------------------------------------------------------

    _renderEquipped(hero) {
        const { x, w } = COL_GEAR
        let y = TOP
        this._header(x, y, w, "EQUIPPED")
        y += 34

        const slots = hero.inventory.equippedSlots
        for (const slot of SLOT_NAMES) {
            const item = slots[slot]
            const rowTop = y
            this._text(x, rowTop, slot.toUpperCase(), { font: "bold 10px Arial", color: COLOR_DIM })
            if (item) {
                const icon = addEntityIcon(this, x + 70, rowTop + 10, item, { display: 16, originX: 0, originY: 0.5, tintFill: true })
                this._objs.push(icon)
                this._text(x + 94, rowTop, this._nameOf(item), { font: "14px Arial", color: this._nameColor(item) })
                this._text(x + 94, rowTop + 19, itemStatLine(item) || item.description, {
                    font: "11px Arial", color: COLOR_DIM, wordWrap: { width: w - 94 },
                })
                this._rowHit(x, rowTop + ITEM_ROW_H / 2 - 2, w, ITEM_ROW_H - 4, "Click to unequip", () => {
                    hero.unequipSlot(slot)
                    audio.play('ui-select')
                    this._render()
                })
            } else {
                this._text(x + 94, rowTop, "(empty)", { font: "14px Arial", color: COLOR_DIM })
            }
            y += ITEM_ROW_H
        }
    }

    // --- PACK ----------------------------------------------------------------

    _renderPack(hero) {
        const { x, w } = COL_PACK
        let y = TOP
        this._header(x, y, w, `PACK  ${hero.items.length} / 10`)
        y += 34

        if (hero.items.length === 0) {
            this._text(x, y, "(empty)", { font: "14px Arial", color: COLOR_DIM })
            return
        }

        hero.items.forEach((item) => {
            const rowTop = y
            const icon = addEntityIcon(this, x, rowTop + 10, item, { display: 16, originX: 0, originY: 0.5, tintFill: true })
            this._objs.push(icon)
            const count = hero.inventory.stackCountOf(item)
            const name = count > 1 ? `${this._nameOf(item)}  x${count}` : this._nameOf(item)
            this._text(x + 24, rowTop, name, { font: "14px Arial", color: this._nameColor(item) })

            // Second line: the item's own numbers, then what equipping it would
            // change — gains in green, losses in red. A consumable has neither
            // and shows its description instead, so the row is never blank.
            const line = itemStatLine(item)
            const deltas = equipDeltas(hero, item)
            const { up, down } = deltaText(deltas)
            let lx = x + 24
            const ly = rowTop + 19
            if (line) {
                const t = this._text(lx, ly, line, { font: "11px Arial", color: COLOR_DIM })
                lx += t.width + 10
            } else if (!deltas) {
                this._text(lx, ly, item.description, { font: "11px Arial", color: COLOR_DIM, wordWrap: { width: w - 150 } })
            }
            if (deltas && deltas.length === 0 && !hero.inventory.equippedAt(item.slot)) {
                // Equippable, slot empty, and yet no change — a ring with no
                // stats. Say so rather than show nothing.
                this._text(lx, ly, "no change", { font: "11px Arial", color: COLOR_DIM })
            }
            if (up) {
                const t = this._text(lx, ly, up, { font: "bold 11px Arial", color: COLOR_GOOD })
                lx += t.width + 10
            }
            if (down) this._text(lx, ly, down, { font: "bold 11px Arial", color: COLOR_BAD })

            // Same two verbs as the Pause panel, same calls. Indices are re-read
            // at click time because the list shifts under every action.
            this._button(x + w - 118, rowTop + 10, item.slot ? "Equip" : "Use", () => {
                const index = hero.items.indexOf(item)
                if (index === -1) return
                hero.toggleItem(index)
                audio.play('ui-select')
                this._render()
            })
            this._button(x + w - 56, rowTop + 10, "Drop", () => {
                const index = hero.items.indexOf(item)
                if (index === -1) return
                hero.dropItem(index)
                this._render()
            })
            y += ITEM_ROW_H
        })
    }

    // --- helpers -------------------------------------------------------------

    _nameOf(item) {
        return item.legendary ? `${item.name} ✦` : item.name
    }

    _nameColor(item) {
        if (item.cursed) return COLOR_BAD
        if (item.legendary) return COLOR_LEGENDARY
        return COLOR_PRIMARY
    }

    _header(x, y, w, label) {
        this._objs.push(
            this.add.text(x, y, label, { font: "15px Arial", color: COLOR_ACCENT }).setOrigin(0, 0.5),
            this.add.rectangle(x, y + 16, w, 1, 0x7a7466, 0.5).setOrigin(0, 0.5)
        )
    }

    _text(x, y, str, style, originX = 0) {
        const t = this.add.text(x, y, str, style).setOrigin(originX, 0)
        this._objs.push(t)
        return t
    }

    _rowHit(x, cy, w, h, hint, onClick) {
        const strip = this.add.rectangle(x, cy, w, h, 0xffffff, 0.001).setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true })
        const hintText = this.add.text(x + w, cy, hint, { font: "10px Arial", color: COLOR_DIM })
            .setOrigin(1, 0.5).setAlpha(0)
        strip.on("pointerover", () => { strip.setFillStyle(0xffffff, 0.07); hintText.setAlpha(1) })
        strip.on("pointerout", () => { strip.setFillStyle(0xffffff, 0.001); hintText.setAlpha(0) })
        strip.on("pointerup", onClick)
        this._objs.push(strip, hintText)
    }

    _button(x, y, label, onClick) {
        const w = 54, h = 18
        const rect = this.add.rectangle(x, y, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        const text = this.add.text(x, y, label, { font: "11px Arial", color: COLOR_PRIMARY }).setOrigin(0.5)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", onClick)
        this._objs.push(rect, text)
    }
}
