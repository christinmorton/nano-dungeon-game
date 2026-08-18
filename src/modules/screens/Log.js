import Phaser from 'phaser'
import gameLog from '../GameLog.js'
import router from '../SceneRouter.js'

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"

export default class Log extends Phaser.Scene {
    constructor() {
        super({ key: "log-scene", active: false })
    }

    create() {
        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.85).setOrigin(0)

        const cx = GAME_W / 2

        this.add.text(cx, 60, "Dungeon Log", {
            font: "60px Arial",
            color: COLOR_ACCENT
        }).setOrigin(0.5)

        this.add.text(cx, 120, "Press Esc to close", {
            font: "13px Arial",
            color: COLOR_DIM
        }).setOrigin(0.5)

        this._renderEntries()

        this.input.keyboard.on("keyup", (event) => {
            if (event.key !== "Escape") return
            router.bind(this)
            router.closeLog()
        })
    }

    _renderEntries() {
        const msgs = gameLog.msgs || []
        if (msgs.length === 0) {
            this.add.text(GAME_W / 2, GAME_H / 2, "(no messages yet)", {
                font: "16px Arial",
                color: COLOR_DIM
            }).setOrigin(0.5)
            return
        }

        const leftX = 100
        const wrapWidth = GAME_W - 200
        const bottomLimit = GAME_H - 40
        let y = 170

        for (const msg of msgs) {
            const text = this.add.text(leftX, y, msg, {
                font: "14px Arial",
                color: COLOR_PRIMARY,
                wordWrap: { width: wrapWidth }
            }).setOrigin(0, 0)
            const next = y + text.height + 6
            if (next > bottomLimit) {
                // Drop the last entry so the panel doesn't bleed off the
                // bottom of the screen. Older entries beyond this cutoff
                // exist in gameLog.msgs but aren't shown this pass.
                text.destroy()
                break
            }
            y = next
        }
    }
}
