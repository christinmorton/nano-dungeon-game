import mapState from '../MapState.js'

// ArenaView — the in-place visual for a combat arena. Bound to the World
// scene (like FogOfWar), it draws the arena bound directly on the dungeon:
// a pulsing outline at the boundary plus a dim over everything OUTSIDE it,
// so the fight area reads as lit and isolated. No scene swap (the doc's
// "in-place overlay" lean). See documents/v3_combat_infrastructure.md
// ("Arena lifecycle" steps 2-3) — this is the overlay/isolate visual; the
// intro banner beat lives in the UI scene.
//
// The arena is a FIXED radius around a FIXED anchor (Battle.anchorX/Y), so
// the geometry never moves once a battle forms — we redraw only when the
// focused battle changes, not every frame. The bound is a CIRCLE (matching
// Battle.contains' Euclidean test): a full-map dim is masked by an inverted
// circle so everything OUTSIDE the ring dims, and the ring itself pulses.

const TILE = 16
const DIM_COLOR = 0x05050a
const DIM_ALPHA = 0.5
const OUTLINE_COLOR = 0xffcc55
const DEPTH_DIM = 8        // over floor/entity sprites (so outside dims), under HUD/hints (30)
const DEPTH_OUTLINE = 9

export default class ArenaView {
    constructor(scene) {
        this.scene = scene
        this.dim = null          // Graphics: full-map dark fill, masked to a ring
        this.maskShape = null    // Graphics: the circle that masks the dim (inverted)
        this.outline = null      // Arc: the pulsing boundary ring
        this.pulse = null        // the outline's alpha tween
        this.focusId = null      // id of the battle currently drawn
    }

    // Called every World tick (when not paused). Draws the first active
    // battle's bound and clears when combat ends. Drawing only the first
    // active battle keeps the dim correct in the common single-arena case;
    // simultaneous arenas (rare, distance-driven) share the one focus.
    sync(battles) {
        const focus = battles.find(b => b.active) || null
        if (!focus) {
            this._teardown()
            return
        }
        if (focus.id === this.focusId) return   // geometry is fixed; nothing to redo
        this._draw(focus)
    }

    _draw(battle) {
        this._teardown()
        this.focusId = battle.id

        const grid = mapState.level
        const mapW = grid[0].length * TILE
        const mapH = grid.length * TILE

        // Arena circle in pixels. Center on the anchor tile's middle; the
        // visual radius encloses the tiles whose centers pass Battle.contains
        // (the +0.5 reaches the far edge of the boundary tiles).
        const cx = (battle.anchorX + 0.5) * TILE
        const cy = (battle.anchorY + 0.5) * TILE
        const radiusPx = (battle.radius + 0.5) * TILE

        // Full-map dim, then mask OUT the arena circle (inverted geometry mask)
        // so only the outside is darkened and the fight area stays lit.
        const dim = this.scene.add.graphics().setDepth(DEPTH_DIM)
        dim.fillStyle(DIM_COLOR, DIM_ALPHA)
        dim.fillRect(0, 0, mapW, mapH)
        this.dim = dim

        const maskShape = this.scene.make.graphics({ add: false })
        maskShape.fillStyle(0xffffff)
        maskShape.fillCircle(cx, cy, radiusPx)
        const mask = maskShape.createGeometryMask()
        mask.invertAlpha = true   // show the dim everywhere EXCEPT the circle
        dim.setMask(mask)
        this.maskShape = maskShape

        // Pulsing boundary ring (stroke-only circle).
        const ring = this.scene.add.circle(cx, cy, radiusPx)
            .setStrokeStyle(2, OUTLINE_COLOR, 0.9)
            .setDepth(DEPTH_OUTLINE)
        this.outline = ring
        this.pulse = this.scene.tweens.add({
            targets: ring,
            alpha: { from: 1, to: 0.35 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        })
    }

    _teardown() {
        if (this.pulse) { this.pulse.stop(); this.pulse = null }
        if (this.outline) { this.outline.destroy(); this.outline = null }
        if (this.dim) { this.dim.clearMask(true); this.dim.destroy(); this.dim = null }
        if (this.maskShape) { this.maskShape.destroy(); this.maskShape = null }
        this.focusId = null
    }

    // Scene restart (floor change) destroys the GameObjects with the scene, so
    // this just drops our stale references. Called from World.create.
    reset() {
        this.pulse = null
        this.outline = null
        this.dim = null
        this.maskShape = null
        this.focusId = null
    }
}
