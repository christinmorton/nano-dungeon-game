import Phaser from 'phaser'
import tm from "../TurnManager"
import dungeon from "../Dungeon.js"
import account from "../Account.js"
import run from "../Run.js"
import mapState from "../MapState.js"
import worldTooltip from "../WorldTooltip.js"
import encounters from "../encounters/index.js"
import ObjectiveMeter from "./ObjectiveMeter.js"

const GAME_W = 80 * 16
const GAME_H = 50 * 16

// m:ss clock for the play-time readout.
function fmtClock(sec) {
    const s = Math.max(0, Math.floor(sec))
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
}

// Intro beat timing. The banner shows for at least MIN_HOLD before any
// key/click can dismiss it (so a held movement key can't skip it on the same
// frame combat starts), and auto-dismisses at AUTO_DISMISS.
const INTRO_MIN_HOLD = 450
const INTRO_AUTO_DISMISS = 2200
const INTRO_DEPTH = 100

// Closing beat. Unlike the intro it never pauses or waits for input — it just
// flashes the outcome and auto-fades, so it can't strand a pause across a
// floor transition the way the intro pause once did.
const OUTRO_HOLD = 700        // ms held at full alpha before fading
const OUTRO_FADE = 450        // fade-in / fade-out duration
const OUTRO_LABELS = { won: 'Victory!', fled: 'Escaped' }
const OUTRO_COLORS = { won: '#ffcc55', fled: '#9fd0ff' }

const BOX_W = 192
const BOX_H = 96
const ABILITIES_W = 128
const ABILITIES_H = 96
const BOX_GAP = 8
const EDGE_MARGIN = 12

const COLOR_BG = 0x1a1a1a
const COLOR_BORDER = 0x4a4a4a

// Three fixed anchors for now; free-placement drag-and-drop is tracked as a
// known issue and lands later.
function resolveBoxOrigin(position) {
    const y = GAME_H - BOX_H - EDGE_MARGIN
    if (position === "bottom-center") {
        return { x: Math.round((GAME_W - BOX_W) / 2), y }
    }
    if (position === "bottom-right") {
        return { x: GAME_W - BOX_W - EDGE_MARGIN, y }
    }
    return { x: EDGE_MARGIN, y }
}

// Abilities box sits to the right of the stats box when the HUD is
// anchored left or center, and to the left when it's anchored right —
// so the pair stays inside the game window regardless of preference.
function resolveAbilitiesOrigin(position, statsOrigin) {
    const y = GAME_H - ABILITIES_H - EDGE_MARGIN
    if (position === "bottom-right") {
        return { x: statsOrigin.x - ABILITIES_W - BOX_GAP, y }
    }
    return { x: statsOrigin.x + BOX_W + BOX_GAP, y }
}

export default class UserInterface extends Phaser.Scene {
    constructor() {
        super({ key: "ui-scene", active: false })
    }

    create () {
        this.createdUI = false
        this._introActive = false

        const worldEvents = this.scene.get('world-scene').events

        worldEvents.once('dungeon-changed', () => {
            this.scene.restart()
        })

        worldEvents.once('createUI', () => {
            this._buildStatsBox()
            // Bind the world tooltip onto this scene so its text sits at
            // zoom 1 and tracks pointer screen coordinates without being
            // scaled by the world camera.
            worldTooltip.bind(this)
            this.createdUI = true
        })

        // Intro beat: World emits 'combat-start' when a battle forms. The
        // listener persists across scene restarts (Phaser reuses the scene
        // instance), so bind it exactly once.
        if (!this._combatListenerBound) {
            worldEvents.on('combat-start', this._showIntro, this)
            worldEvents.on('combat-end', this._showOutro, this)
            this._combatListenerBound = true
        }

        // Objective progress meter — top-center, shown while a battle is
        // active. Reusable widget fed the focused battle's objective progress
        // each frame in update().
        this.objectiveMeter = new ObjectiveMeter(this, { x: GAME_W / 2, y: 18 })

        // Play-time readout (run-time budgeting) — top-left, screen space. Shows the
        // current floor's real time + rounds and the run total, updated each frame.
        // Blank in the arena/training benches (no run timing there).
        this._timeText = this.add.text(10, 8, "", {
            font: "13px Arial", color: "#cfc6b8"
        }).setDepth(INTRO_DEPTH).setScrollFactor(0)
    }

    // Drive the objective meter off the active battle each frame. Shows while a
    // battle is live, hides otherwise. (Runs at zoom 1 on the UI scene; the
    // world camera's zoom doesn't scale it.)
    update() {
        // Play-time readout — refreshed every frame. Hidden on the arena/training
        // benches (window.ARENA_MODE) and before a real run's stats exist.
        if (this._timeText) {
            const arena = typeof window !== "undefined" && window.ARENA_MODE
            if (arena || !run.stats) {
                this._timeText.setText("")
            } else {
                const floor = mapState.levelManager
                    ? mapState.levelManager.currentLevel + 1
                    : 1
                this._timeText.setText(
                    `Floor ${floor}   ${fmtClock(run.floorSeconds())}  ·  ${run.floorRounds()}r      Run ${fmtClock(run.runSeconds)}`
                )
            }
        }

        if (!this.objectiveMeter) return
        const battle = encounters.battles.find(b => b.active)
        if (battle && battle.objective) {
            this.objectiveMeter.set(battle.objective.progress(battle), battle.objective.status(battle))
            this.objectiveMeter.show()
        } else {
            this.objectiveMeter.hide()
        }
    }

    // The "focus into the fight" beat: freeze the game (dungeon.paused) and
    // reveal a screen-space banner with the threat label + roster, dismissed
    // by any key/click or after a short auto-timeout. Drawn on the UI scene so
    // it sits at zoom 1 (the world camera is zoomed 2x). See
    // documents/v3_combat_infrastructure.md ("Arena lifecycle" step 2).
    _showIntro({ threat, roster }) {
        if (this._introActive) return
        this._introActive = true
        this._introDismissed = false
        dungeon.paused = true

        const cx = GAME_W / 2
        const cy = GAME_H * 0.32

        const backdrop = this.add.rectangle(0, cy, GAME_W, 132, 0x000000, 0.55)
            .setOrigin(0, 0.5).setDepth(INTRO_DEPTH)
        const title = this.add.text(cx, cy - 32, threat, {
            font: '48px Arial', color: '#ffcc55'
        }).setOrigin(0.5).setDepth(INTRO_DEPTH + 1)
        const list = this.add.text(cx, cy + 14, roster.join('   ·   '), {
            font: '20px Arial', color: '#e8e8e8'
        }).setOrigin(0.5).setDepth(INTRO_DEPTH + 1)
        const hint = this.add.text(cx, cy + 48, 'press any key', {
            font: '13px Arial', color: '#8a8a8a'
        }).setOrigin(0.5).setDepth(INTRO_DEPTH + 1)

        this._introParts = [backdrop, title, list, hint]
        this._introParts.forEach(p => p.setAlpha(0))
        this.tweens.add({ targets: this._introParts, alpha: 1, duration: 280, ease: 'Power2' })

        const dismiss = () => this._hideIntro()
        // Hold the banner briefly before accepting input, then listen.
        this.time.delayedCall(INTRO_MIN_HOLD, () => {
            if (this._introDismissed) return
            this.input.keyboard.once('keydown', dismiss)
            this.input.once('pointerdown', dismiss)
        })
        this._introTimer = this.time.delayedCall(INTRO_AUTO_DISMISS, dismiss)
    }

    _hideIntro() {
        if (this._introDismissed) return
        this._introDismissed = true
        if (this._introTimer) this._introTimer.remove()
        this.tweens.add({
            targets: this._introParts,
            alpha: 0,
            duration: 220,
            ease: 'Power2',
            onComplete: () => {
                this._introParts.forEach(p => p.destroy())
                this._introParts = null
                this._introActive = false
                dungeon.paused = false
            }
        })
    }

    // The closing beat: a brief screen-space flash of the outcome when a fight
    // resolves (World emits 'combat-end' with { outcome }). Non-blocking by
    // design — fades in, holds, fades out, self-destructs; it never pauses the
    // game or waits for input, so it can't strand state across a transition.
    // Only the player-facing outcomes ('won' / 'fled') get a banner; a hero
    // death is owned by the DeathScreen, so anything else is skipped.
    _showOutro({ outcome, anchorX, anchorY } = {}) {
        const label = OUTRO_LABELS[outcome]
        if (!label) return

        // Clear any still-fading banner so back-to-back fights don't stack text.
        if (this._outroText) this._outroText.destroy()

        // Center on the arena circle (world space) projected into this scene's
        // screen space via the world camera — the UI scene runs at zoom 1 while
        // the world camera is zoomed/scrolled. worldView accounts for both, so
        // (world - worldView origin) * zoom lands on screen. Falls back to a
        // fixed upper-center spot if the anchor or camera isn't available.
        const TILE = 16
        let px = GAME_W / 2
        let py = GAME_H * 0.32
        const cam = this.scene.get('world-scene')?.cameras?.main
        if (cam && anchorX != null && anchorY != null) {
            px = ((anchorX + 0.5) * TILE - cam.worldView.x) * cam.zoom
            py = ((anchorY + 0.5) * TILE - cam.worldView.y) * cam.zoom
        }

        const text = this.add.text(px, py, label, {
            font: '44px Arial', color: OUTRO_COLORS[outcome] || '#e8e8e8'
        }).setOrigin(0.5).setDepth(INTRO_DEPTH + 1).setAlpha(0)
        this._outroText = text

        this.tweens.add({ targets: text, alpha: 1, duration: OUTRO_FADE, ease: 'Power2' })
        this.time.delayedCall(OUTRO_FADE + OUTRO_HOLD, () => {
            this.tweens.add({
                targets: text,
                alpha: 0,
                duration: OUTRO_FADE,
                ease: 'Power2',
                onComplete: () => {
                    text.destroy()
                    if (this._outroText === text) this._outroText = null
                }
            })
        })
    }

    _buildStatsBox() {
        const position = account.getPreferences().hudPosition || "bottom-left"
        const origin = resolveBoxOrigin(position)
        const abilitiesOrigin = resolveAbilitiesOrigin(position, origin)

        this.add.rectangle(origin.x, origin.y, BOX_W, BOX_H, COLOR_BG)
            .setOrigin(0)
            .setStrokeStyle(1, COLOR_BORDER)

        this.add.rectangle(abilitiesOrigin.x, abilitiesOrigin.y, ABILITIES_W, ABILITIES_H, COLOR_BG)
            .setOrigin(0)
            .setStrokeStyle(1, COLOR_BORDER)

        for (let entity of tm.entities) {
            if (entity.type === "hero" && typeof entity.createUI === "function") {
                entity.createUI({
                    scene: this,
                    x: origin.x + 8,
                    y: origin.y + 8,
                    width: BOX_W - 16,
                    abilitiesX: abilitiesOrigin.x + 8,
                    abilitiesY: abilitiesOrigin.y + 8,
                    abilitiesWidth: ABILITIES_W - 16,
                    abilitiesHeight: ABILITIES_H - 16
                })
                break
            }
        }
    }
}
