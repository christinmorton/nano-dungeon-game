import Phaser from 'phaser'
import router from '../SceneRouter.js'
import inputMap from '../InputMap.js'

// The controls reference. Reachable from the title screen (before you start)
// and from Pause (mid-run), because a player who needs it needs it in both
// places.
//
// This screen exists because nothing else in the game said any of it. The core
// loop is mouse-playable — click to move, click to attack, click to interact —
// but abilities, items, equipment and pausing are all keyboard, and none of
// those keys appeared anywhere in the UI. A stranger opening this on itch had
// no way to learn them short of pressing every key.
//
// EVERY BINDING HERE IS READ FROM InputMap, never typed as a literal. The
// interact prompts on doors and chests said "[E]" for months after interact
// moved to F, precisely because a human typed the letter into a string. A
// controls screen is the worst possible place to repeat that: it is the one
// screen a player will believe.
//
// What is deliberately NOT listed: Y/N (accept/decline, for the cut pact
// system), V/D (beckon/dismiss, for cut companions). Their handlers survive as
// harmless no-ops on an empty follower list, but a documented key that does
// nothing reads as a broken game — the same reasoning that removed four
// buttons from the Pause menu.

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
const COLOR_KEY = "#e8dfd0"

// Layout. Two columns, because the full binding list does not fit in one at a
// readable size — the item section alone is three rows of seven keys.
const COL_L = 120
const COL_R = 700
const COL_W = 470
const KEY_W = 135          // gutter between the key column and its description
const ROW_H = 26           // minimum row pitch; a wrapped description gets more
const SECTION_GAP = 22
const TOP = 190

export default class Controls extends Phaser.Scene {
    constructor() {
        super({ key: "controls-scene", active: false })
    }

    create() {
        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.92).setOrigin(0)

        const cx = GAME_W / 2

        this.add.text(cx, 60, "Controls", {
            font: "60px Arial",
            color: COLOR_ACCENT
        }).setOrigin(0.5)

        this.add.text(cx, 120, "Press Esc or click anywhere to close", {
            font: "13px Arial",
            color: COLOR_DIM
        }).setOrigin(0.5)

        this._renderColumn(COL_L, this._leftSections())
        this._renderColumn(COL_R, this._rightSections())

        // Close on Escape or on any click. Both, because this screen is reached
        // from the mouse-driven title card and from the keyboard-driven pause
        // menu, and a player arriving by either route reaches for that one.
        //
        // The arming delay is the guard against the click that OPENED this
        // screen also closing it: the button's pointerup can still be in flight
        // when create() runs, so an unguarded listener dismisses the screen on
        // the same gesture and it never appears. (SceneRouter.openPause carries
        // a 200ms debounce for the same reason.)
        this._armedAt = this.time.now + 150

        this.input.keyboard.on("keyup", (event) => {
            if (event.key !== "Escape") return
            this._close()
        })
        this.input.on("pointerup", () => this._close())
    }

    _close() {
        if (this.time.now < this._armedAt) return
        router.bind(this)
        router.closeControls()
    }

    // --- content -------------------------------------------------------------
    // Each section is { title, rows: [[keys, description], ...] }. `keys` is
    // built from InputMap so a rebind (or a corrected typo) lands here for free.

    _leftSections() {
        const slots = inputMap.abilitySlotKeys
        // The bar's last slot is the ultimate — see InputMap.ultimateSlotIndex.
        const kitKeys = slots.slice(0, -1).map(k => k.toUpperCase()).join(" ")
        const ultimateKey = inputMap.slotLabel(slots.length - 1)

        return [
            {
                title: "Moving",
                rows: [
                    ["Arrow Keys", "Move one tile"],
                    ["Click a tile", "Step toward it"],
                    ["Shift + Click", "Travel there — keeps walking until something interrupts"],
                    [inputMap.keyLabel('passTurn'), "Wait — pass the rest of your turn"],
                ],
            },
            {
                title: "Fighting",
                rows: [
                    ["Click an enemy", "Attack it, if it is in weapon range"],
                    // Count comes from the keymap, not a typed word: the bar has
                    // five kit slots and the classes currently fill four, so a
                    // hardcoded "four" would go stale the moment a fifth lands.
                    [kitKeys, `Abilities — your ${slots.length - 1} class skills`],
                    [ultimateKey, "Ultimate — long cooldown, no cost gate"],
                    ["Click a target", "Aim an ability that asks for one"],
                    [inputMap.keyLabel('retreat'), "Retreat from combat"],
                ],
            },
        ]
    }

    _rightSections() {
        // Slot letters straight from the keymap, in a stable printed order
        // rather than object order, so the list reads head-to-toe like a
        // character sheet instead of however the table happens to be written.
        const ORDER = ['mainhand', 'offhand', 'head', 'body', 'gloves', 'feet', 'accessory']
        const byslot = {}
        for (const [token, slot] of Object.entries(inputMap.equipSlotKeys)) {
            byslot[slot] = token.toUpperCase()
        }
        const unequipRows = ORDER
            .filter(slot => byslot[slot])
            .map(slot => [byslot[slot], `Unequip ${slot}`])

        const sections = [
            {
                title: "Items",
                rows: [
                    ["1 - 0", "Equip or use the item in that carry slot"],
                    ["Shift + 1 - 0", "Drop that item"],
                    [inputMap.keyLabel('interact'), "Interact — doors, chests, stairs, bags"],
                ],
            },
        ]
        // The unequip letters are an empty table as of 2026-10-03 (unequipping
        // is by click on the Character screen and the Pause panel). The section
        // only prints if a rebind ever puts something back in it.
        if (unequipRows.length) sections.push({ title: "Unequip", rows: unequipRows })
        sections.push({
            title: "Screens",
            rows: [
                [inputMap.keyLabel('character'), "Character — your stats, your gear, and what each item in your pack would change"],
                ["Esc", "Pause — inventory, volume, and this screen"],
            ],
        })
        return sections
    }

    // --- rendering -----------------------------------------------------------

    _renderColumn(x, sections) {
        let y = TOP
        for (const section of sections) {
            this.add.text(x, y, section.title.toUpperCase(), {
                font: "bold 15px Arial",
                color: COLOR_ACCENT
            }).setOrigin(0, 0)
            y += ROW_H + 2

            for (const [keys, description] of section.rows) {
                this.add.text(x, y, keys, {
                    font: "bold 14px Arial",
                    color: COLOR_KEY
                }).setOrigin(0, 0)

                const text = this.add.text(x + KEY_W, y, description, {
                    font: "14px Arial",
                    color: COLOR_PRIMARY,
                    wordWrap: { width: COL_W - KEY_W }
                }).setOrigin(0, 0)

                // Advance by what the description ACTUALLY measures, not by a
                // fixed pitch. Several of these wrap to two lines, and a fixed
                // ROW_H would run the next row straight through the second one.
                y += Math.max(ROW_H, text.height + 8)
            }
            y += SECTION_GAP
        }
    }
}
