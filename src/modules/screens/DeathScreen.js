import Phaser from 'phaser'
import router from '../SceneRouter.js'
import run from '../Run.js'

// Modal shown when the hero dies — launched OVER the (paused) World+UI so the
// dimmed dungeon and the player's tombstone show through. A grey-black overlay
// fades in, a countdown ticks down, and input is locked to two choices:
//   Restart  -> reload to the intro (a fresh game)
//   End Run  -> the existing GameOver score screen
// The countdown defaults to End Run on expiry. This is the "revival window"
// from the design — the actual revive action slots in here later.

const GAME_W = 80 * 16
const GAME_H = 50 * 16
const COUNTDOWN_SECONDS = 10

export default class DeathScreen extends Phaser.Scene {
    constructor() {
        super({ key: 'death-scene', active: false })
    }

    create() {
        const cx = GAME_W / 2
        const cy = GAME_H / 2

        // The scene instance is reused across deaths (Phaser keeps one
        // instance), so reset the single-fire guard every time it opens —
        // otherwise a guard left true by a prior death blocks all input.
        this._done = false

        // Grey-black overlay, fading in over the paused dungeon.
        const overlay = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0a0a0a, 1)
            .setOrigin(0)
            .setAlpha(0)
        this.tweens.add({ targets: overlay, alpha: 0.72, duration: 600, ease: 'Power2' })

        this.add.text(cx, cy - 120, 'You Died', {
            font: '72px Arial', color: '#fca5a5'
        }).setOrigin(0.5)

        this._remaining = COUNTDOWN_SECONDS
        this._countdownText = this.add.text(cx, cy - 30, this._countdownLabel(), {
            font: '26px Arial', color: '#7a7466'
        }).setOrigin(0.5)

        const choices = []
        if (run.canRevive()) {
            choices.push({ label: '[ V ]  Revive  (half HP)', onSelect: () => this._revive() })
        }
        choices.push({ label: '[ Enter ]  End Run', onSelect: () => this._endRun() })
        choices.forEach((choice, i) => this._makeChoice(cx, cy + 50 + i * 50, choice.label, choice.onSelect))

        if (run.canRevive()) {
            this.input.keyboard.on('keydown-V', () => this._revive())
        }
        this.input.keyboard.on('keydown-ENTER', () => this._endRun())

        this.time.addEvent({
            delay: 1000,
            repeat: COUNTDOWN_SECONDS - 1,
            callback: () => {
                this._remaining -= 1
                this._countdownText.setText(this._countdownLabel())
                if (this._remaining <= 0) this._endRun()
            }
        })
    }

    _countdownLabel() {
        return `Ending run in ${this._remaining}…`
    }

    _makeChoice(x, y, label, onClick) {
        const text = this.add.text(x, y, label, { font: '24px Arial', color: '#facc15' })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
        text.on('pointerup', onClick)
        text.on('pointerover', () => text.setColor('#fde68a'))
        text.on('pointerout', () => text.setColor('#facc15'))
        return text
    }

    _revive() {
        if (this._done) return
        this._done = true
        this.scene.stop()
        run.revive()
    }

    _endRun() {
        if (this._done) return
        this._done = true
        // Smooth fade to black, then route to the score screen. Resume the
        // paused World+UI first so endRun routes from an ACTIVE scene (stopping
        // the still-paused scenes directly leaves a frozen, input-dead screen).
        this.cameras.main.fadeOut(500, 0, 0, 0)
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.stop()
            router.resumeFromDeath()
            run.endRun('loss')
        })
    }
}
