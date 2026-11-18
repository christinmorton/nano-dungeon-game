import Phaser from 'phaser'
import classes from '../Classes.js'
import dungeon from '../Dungeon.js'
import router from '../SceneRouter.js'
import inputMap from '../InputMap.js'
import audio from '../Audio.js'
import { preloadSheets, addEntityIcon } from '../assetLoader.js'

// Title screen and class picker in one.
//
// Until this existed, every run was a Wizard by accident: Dungeon.placePlayer
// resolves `classes[this.hero] || classes.Wizard` and nothing ever set
// dungeon.hero, so the fallback always won. Eight of the twelve abilities had
// never been fired. All this screen has to do is write that one string.
//
// v3's Intro is 297 lines, nearly all of it systems v5 cuts — name entry, the
// Account, a Loadout handoff. Written small instead, keeping only its contract:
// set dungeon.hero, then hand off through the router.
//
// THE HANDOFF IS THE ROUTER'S. router.startGame() does stop(intro) -> run(ui) ->
// run(world), and that order is load-bearing: World emits 'createUI' during its
// own create() and the UI binds that listener in its create(), so starting World
// first silently drops the HUD. Calling startGame() inherits the right order —
// do not replace it with scene.start calls here.

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
// Ultimates get their own colour so the R slot reads as a different kind of
// thing from the four kit abilities at a glance.
const COLOR_ULTIMATE = "#c4a6ff"

const CARD_W = 380
// Sized against the real content, not by eye — a 480px first guess put the last
// line at the exact pixel of the bottom edge.
//
// Budget from the divider down, re-measured when the fifth kit ability landed
// (scope doc §10.6). Four kit abilities plus the ultimate were ~282px. The
// fifth adds a 17px name row, two wrapped description lines at 12px, and 8px of
// padding = 49px, giving ~331px of content.
//
// A row is only 49px if its description wraps to TWO lines, which at this
// width (CARD_W - 46 = 334px, ~66 characters) means keeping each under ~132
// characters. Mana Beam's first draft ran to 165 and needed a third line;
// it was shortened rather than paying for the height. If a future ability
// wants a longer description, this number moves again — measure, don't guess.
//
// 331px of content in 377px of space preserves the original ~46px of slack for
// font metrics to differ without text escaping the frame.
const CARD_H = 629
const CARD_TOP = 88
const CARD_XS = [40, 450, 860]

// Offsets from CARD_TOP, kept together so the header can be retuned in one place.
const ROW = {
    portrait: 48,
    name: 98,
    role: 122,
    hp: 144,
    stats1: 166,
    stats2: 183,
    gear: 203,
    divider: 240,
    abilities: 252,
}

// Display copy only. Kept consistent with each profile's own header comment and
// its stat spread — Warrior "soldier, not tank", Ranger "evasion and range",
// Wizard "squishy by design" — so the card and the profile cannot disagree about
// what the class is for.
const ROLES = {
    Warrior: "Melee  ·  heavy armour, no magic",
    Ranger: "Ranged  ·  evasive, fast",
    Wizard: "Caster  ·  powerful, fragile",
}

// startingItems mixes profile-name strings ('sword', 'scrollOfFireball') with
// real class references (the Wizard's potions). Both need a readable label, so
// camelCase and ClassNames both get split on their capitals.
function itemLabel(entry) {
    const raw = typeof entry === "string" ? entry : (entry?.name ?? "item")
    return raw
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .toLowerCase()
}

// Ability display name + description, read off a throwaway instance.
//
// It has to be an INSTANCE. Both fields are class fields, and two of the twelve
// diverge from their filenames — Blink.js is "Riftstep", FrostBolt.js is "Rime
// Lance" — so constructor.name would print the wrong thing here, and something
// worse once minified. Ability's constructor only assigns hero and a counter, so
// building one with no hero is free of side effects; guarded anyway, because a
// throwing ability must not take the menu down with it.
function abilityInfo(AbilityClass) {
    try {
        const instance = new AbilityClass()
        return {
            name: instance.name || "Unnamed",
            description: instance.description || "",
        }
    } catch (e) {
        console.warn(`[intro] could not read ability ${AbilityClass?.name}:`, e)
        return null
    }
}

export default class Intro extends Phaser.Scene {
    constructor() {
        super({ key: "intro-scene", active: false })
    }

    preload() {
        // The Kenney sheet is the PORTRAIT FALLBACK, not decoration: hero art is
        // gitignored, so on a clean clone addEntityIcon drops back to
        // profile.tile against this sheet. World loads it too, but World has not
        // run yet.
        this.load.spritesheet('tiles', 'kenney_1-bit-pack/Tilesheet/colored-transparent.png', {
            frameWidth: 16,
            frameHeight: 16,
            spacing: 1
        })
        preloadSheets(this, ['heroes'])
        // Idempotent — World calls this too, and whichever runs first pays.
        audio.preload(this)
    }

    create() {
        audio.bind(this)

        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000).setOrigin(0)

        // The title went back in on 2026-10-17 (scope doc §10.19), into the slot
        // 1b5db00 left for it: heading at y=34, prompt back down at y=68. CARD_TOP
        // is measured from the frame, not from this text, so the cards did not move.
        // 42px Arial holds all 19 characters on one line inside GAME_W with room
        // to spare — if the name ever grows, shrink the font before stacking it,
        // because the prompt and CARD_TOP both assume a single heading line.
        this.add.text(GAME_W / 2, 34, "THE LANTERN COMPANY", {
            font: "42px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(0.5)

        this.add.text(GAME_W / 2, 68, "Choose who goes down.", {
            font: "16px Arial",
            color: COLOR_DIM
        }).setOrigin(0.5)

        // Registry key order is the picker order, and the key IS what
        // placePlayer indexes with — no separate id to keep in sync.
        this.classKeys = Object.keys(classes)
        this.cards = this.classKeys.map((key, i) => this._makeCard(key, CARD_XS[i]))
        this.selected = 0

        // Two buttons side by side. Each is 260 wide, so ±140 from centre leaves
        // a 20px gutter between them.
        this.descendButton = this._makeButton(GAME_W / 2 - 140, 748, "DESCEND", () => this._commit())
        // Controls sits on the title screen and not only behind Pause, because a
        // player who has to start a run to find out how to play has already had
        // the bad first minute this screen exists to prevent.
        this._makeButton(GAME_W / 2 + 140, 748, "CONTROLS", () => {
            router.bind(this)
            router.openControls()
        })

        this.add.text(GAME_W / 2, 780,
            "1 / 2 / 3 or click to choose     ·     Enter to begin", {
            font: "14px Arial",
            color: COLOR_DIM
        }).setOrigin(0.5)

        this._refresh()

        this.input.keyboard.on("keyup", (event) => {
            const key = event.key
            if (key === "1" || key === "2" || key === "3") {
                this._select(Number(key) - 1)
            } else if (key === "ArrowLeft") {
                this._select(this.selected - 1)
            } else if (key === "ArrowRight") {
                this._select(this.selected + 1)
            } else if (key === "Enter" || key === " " || key === "Spacebar") {
                this._commit()
            }
        })
    }

    _makeCard(key, cardX) {
        const profile = classes[key]
        const cx = cardX + CARD_W / 2
        const left = cardX + 18

        const rect = this.add.rectangle(cx, CARD_TOP + CARD_H / 2, CARD_W, CARD_H, 0x1a1a1a)
            .setStrokeStyle(2, 0x4a4a4a)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerup", () => this._select(this.classKeys.indexOf(key)))

        // Portrait. Passed as a bare entity-shaped object: addEntityIcon wants
        // .art and .tile, and falls back to the Kenney tile when the PNG is
        // absent, which is the normal state of a fresh clone.
        addEntityIcon(this, cx, CARD_TOP + ROW.portrait, { art: profile.art, tile: profile.tile }, { display: 64 })

        const name = this.add.text(cx, CARD_TOP + ROW.name, profile.name.toUpperCase(), {
            font: "24px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(0.5)

        this.add.text(cx, CARD_TOP + ROW.role, ROLES[key] || "", {
            font: "12px Arial",
            color: COLOR_DIM
        }).setOrigin(0.5)

        // HP comes from the profile's own formula rather than a copied number,
        // so rebalancing a class updates the card for free.
        const hp = typeof profile.hpFormula === "function"
            ? profile.hpFormula(profile.stats)
            : "?"
        this.add.text(cx, CARD_TOP + ROW.hp, `HP ${hp}`, {
            font: "14px Arial",
            color: COLOR_ACCENT
        }).setOrigin(0.5)

        const s = profile.stats || {}
        this.add.text(cx, CARD_TOP + ROW.stats1,
            `STR ${s.STR}   DEX ${s.DEX}   CON ${s.CON}`, {
            font: "12px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(0.5)
        this.add.text(cx, CARD_TOP + ROW.stats2,
            `SPD ${s.SPD}   INT ${s.INT}   MAG ${s.Magic}`, {
            font: "12px Arial",
            color: COLOR_PRIMARY
        }).setOrigin(0.5)

        const gear = (profile.startingItems || []).map(itemLabel).join(", ")
        this.add.text(cx, CARD_TOP + ROW.gear, gear ? `Starts with ${gear}` : "No starting gear", {
            font: "11px Arial",
            color: COLOR_DIM,
            wordWrap: { width: CARD_W - 40 },
            align: "center"
        }).setOrigin(0.5, 0)

        this.add.rectangle(cx, CARD_TOP + ROW.divider, CARD_W - 36, 1, 0x4a4a4a)

        // Abilities, laid out with a running y because the descriptions wrap to
        // different heights. Hotkeys are read from InputMap rather than
        // hardcoded, so the card stays truthful if the keys are ever rebound.
        let y = CARD_TOP + ROW.abilities
        const row = (label, description, color) => {
            this.add.text(left, y, label, {
                font: "13px Arial",
                color
            }).setOrigin(0, 0)
            y += 17
            const desc = this.add.text(left + 6, y, description, {
                font: "10px Arial",
                color: COLOR_DIM,
                wordWrap: { width: CARD_W - 46 }
            }).setOrigin(0, 0)
            y += desc.height + 8
        }

        profile.abilities.forEach((AbilityClass, slot) => {
            const info = abilityInfo(AbilityClass)
            if (!info) return
            const hotkey = (inputMap.abilitySlotKeys[slot] || "?").toUpperCase()
            row(`[${hotkey}]  ${info.name}`, info.description, COLOR_ACCENT)
        })

        // The ultimate, set apart. It is a separate profile field rather than a
        // fifth entry in `abilities`, because BaseHero drops it into the
        // dedicated last slot regardless of how big the kit is — so its hotkey
        // comes from ultimateSlotIndex, not from a position in the list.
        if (profile.ultimate) {
            const info = abilityInfo(profile.ultimate)
            if (info) {
                y += 2
                this.add.rectangle(cx, y, CARD_W - 60, 1, 0x4a4a4a)
                y += 8
                const hotkey = (inputMap.abilitySlotKeys[inputMap.ultimateSlotIndex] || "R").toUpperCase()
                row(`[${hotkey}]  ${info.name}   ULTIMATE`, info.description, COLOR_ULTIMATE)
            }
        }

        return { rect, name, key }
    }

    // Selection and commitment are separate on purpose: a stray click picks a
    // class, it does not start a run.
    _select(index) {
        const next = Phaser.Math.Wrap(index, 0, this.cards.length)
        if (next === this.selected) return
        this.selected = next
        audio.play('ui-select')
        this._refresh()
    }

    _refresh() {
        this.cards.forEach((card, i) => {
            const active = i === this.selected
            card.rect.setStrokeStyle(active ? 3 : 2, active ? 0xfacc15 : 0x4a4a4a)
            card.rect.setFillStyle(active ? 0x232323 : 0x1a1a1a)
            card.name.setColor(active ? COLOR_ACCENT : COLOR_PRIMARY)
        })
    }

    _commit() {
        const key = this.classKeys[this.selected]
        if (!key) return
        // The whole point of the screen. placePlayer reads this string.
        dungeon.hero = key
        audio.play('descend')
        router.bind(this)
        router.startGame()
    }

    _makeButton(x, y, label, onClick) {
        const w = 260
        const h = 40
        const rect = this.add.rectangle(x, y, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        this.add.text(x, y, label, { font: "18px Arial", color: COLOR_PRIMARY }).setOrigin(0.5)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", onClick)
        return rect
    }
}
