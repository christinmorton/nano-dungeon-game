import Phaser from 'phaser'
import tm from "../TurnManager"
import dungeon from "../Dungeon.js"
import prefs from "../Prefs.js"
import run from "../Run.js"
import mapState from "../MapState.js"
import worldTooltip from "../WorldTooltip.js"

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

    }

    _buildStatsBox() {
        const position = prefs.getPreferences().hudPosition || "bottom-left"
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
