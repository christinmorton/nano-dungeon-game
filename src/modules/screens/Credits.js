import Phaser from 'phaser'
import router from '../SceneRouter.js'

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"

const SECTIONS = [
    {
        heading: "Game",
        lines: [
            "Nano Dungeon",
            "v0.1 (pre-fork)"
        ]
    },
    {
        heading: "Built with",
        lines: [
            "Phaser 3",
            "Vite",
            "pathfinding (npm)"
        ]
    },
    {
        heading: "Sprites",
        lines: [
            "Kenney 1-bit pack",
            "kenney.nl"
        ]
    },
    {
        heading: "Inspired by",
        lines: [
            "Mazes for Programmers — Jamis Buck"
        ]
    },
    {
        heading: "Thanks",
        lines: [
            "Student collaborators driving the creative direction",
            "The Phaser community"
        ]
    }
]

export default class Credits extends Phaser.Scene {
    constructor() {
        super({ key: "credits-scene", active: false })
    }

    create() {
        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.85).setOrigin(0)

        const cx = GAME_W / 2

        this.add.text(cx, 60, "Credits", {
            font: "60px Arial",
            color: COLOR_ACCENT
        }).setOrigin(0.5)

        let y = 150
        for (const section of SECTIONS) {
            this.add.text(cx, y, section.heading.toUpperCase(), {
                font: "14px Arial",
                color: COLOR_DIM
            }).setOrigin(0.5)
            y += 24
            for (const line of section.lines) {
                this.add.text(cx, y, line, {
                    font: "18px Arial",
                    color: COLOR_PRIMARY
                }).setOrigin(0.5)
                y += 24
            }
            y += 16
        }

        this._makeBackButton(cx, GAME_H - 80)

        this.add.text(cx, GAME_H - 36, "Press Esc or click Back", {
            font: "13px Arial",
            color: COLOR_DIM
        }).setOrigin(0.5)

        this.input.keyboard.on("keyup", (event) => {
            if (event.key === "Escape") this._close()
        })
    }

    _close() {
        router.bind(this)
        router.closeCredits()
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
