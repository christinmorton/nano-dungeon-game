import Phaser from "phaser"

// SheetView — the sheet as a PICTURE, with the declared grid drawn over it.
//
// Why this exists: the catalog grid (AssetBrowser.renderGroup) reflows frames
// into ~12 padded columns, which is the right shape for browsing one tile at a
// time and the WRONG shape for two jobs this track needs:
//
//   1. VERIFYING A GRID. Several sheets carry a _meta note saying the tile size
//      was inferred from sibling sheets and ends "VERIFY ... before wiring."
//      You cannot verify a grid against reflowed, padded cells — you need the
//      lines drawn on the actual PNG, where a wrong size reads instantly as
//      lines cutting through the middle of tiles.
//   2. NAMING MULTI-FRAME OBJECTS. A cottage occupying sheet cols 4-6 x rows
//      12-15 appears as 12 unrelated cells scattered across four catalog rows.
//      There is nothing coherent to drag a box around. Here it looks like a
//      cottage, so you can drag a box around the cottage.
//
// Both units are authored from this one surface:
//   drag across >1 frame  -> a named REGION   (objects: buildings, trees, furniture)
//   click a single frame  -> a per-frame LABEL (terrain: "<terrain>:<dir>")
//   click inside a region -> rename it (blank deletes)
//
// The view is READ-ONLY about geometry: it never changes a frame index or a
// declared grid, it only draws them and reports what was clicked. Persistence
// belongs to the host (AtlasScene owns the label store).

const MIN_ZOOM = 1
const MAX_ZOOM = 16
const PAN_STEP = 64

// Backdrops the sheet can be drawn on, cycled with B. This is not a cosmetic
// preference — it is a correctness tool. These sheets carry opaque near-BLACK
// shadow pixels (the castletown tree's shadow spills a full column past its
// canopy), and on a dark backdrop those are indistinguishable from transparent
// background. Sizing a region by eye on one backdrop silently clips the object.
// Cycle to a light backdrop and the shadow appears; cycle to mid-grey and both
// dark and light art stay readable.
const BACKDROPS = [
    { color: 0x14120e, name: "dark" },
    { color: 0xb8b0a4, name: "light" },
    { color: 0x6b6b6b, name: "mid" },
    { color: 0xd946ef, name: "magenta" },   // maximum contrast against both extremes
]
const COLOR_GRID = 0x3a4a5a
const COLOR_GRID_MAJOR = 0x5a7a9a      // every 5th line, so counting cols/rows is possible
const COLOR_REGION = 0x7dd3fc
const COLOR_REGION_FILL = 0x7dd3fc
const COLOR_SELECT = 0xfacc15
const COLOR_HOVER = 0xffffff
const COLOR_LABELED = 0x7fe0a0

export default class SheetView {
    constructor(scene) {
        this.scene = scene
        this.sheet = null
        this.zoom = 4
        this.panX = 0
        this.panY = 0
        this.showLabels = true
        this.visible = false
        this.backdrop = 0

        // Draw order: sheet image, then grid, then region/selection overlay, then
        // text. Separate containers so a hover repaint doesn't rebuild the image.
        this.root = scene.add.container(0, 0).setDepth(200).setVisible(false)
        this.bg = scene.add.rectangle(0, 0, 10, 10, BACKDROPS[0].color).setOrigin(0, 0)
        this.viewRoot = scene.add.container(0, 0)          // pans/zooms with the sheet
        this.image = null
        this.gridGfx = scene.add.graphics()
        this.overlayGfx = scene.add.graphics()
        this.textRoot = scene.add.container(0, 0)
        this.viewRoot.add([this.gridGfx, this.overlayGfx, this.textRoot])

        this.headerText = scene.add.text(0, 0, "", { font: "16px monospace", color: "#facc15" })
        this.metaText = scene.add.text(0, 0, "", { font: "12px monospace", color: "#cfc6b8" })
        this.warnText = scene.add.text(0, 0, "", { font: "12px monospace", color: "#ff8a65" })
        this.hintText = scene.add.text(0, 0, "", { font: "11px monospace", color: "#7a7466" })
        this.cursorText = scene.add.text(0, 0, "", { font: "12px monospace", color: "#7dd3fc" }).setOrigin(1, 0)

        this.root.add([this.bg, this.viewRoot, this.headerText, this.metaText,
            this.warnText, this.hintText, this.cursorText])

        this._drag = null        // { from: {col,row}, to: {col,row} } while dragging
        this._hover = null       // { col, row }
        this._bindInput()
    }

    // ---- geometry ----------------------------------------------------------
    // Everything below converts between three spaces: pixels on the PNG, frame
    // (col,row), and screen. `step` is the pitch between frame origins — tile
    // size PLUS spacing, which is why the Kenney sheet (16px tiles, 1px spacing)
    // fits 49 columns in 832px and not 52.

    _meta() { return (this.sheet && this.sheet.ref && this.sheet.ref._meta) || {} }

    _grid() {
        const m = this._meta()
        const size = m.tileSize || 16
        return {
            fw: m.frameWidth || size,
            fh: m.frameHeight || size,
            spacing: m.spacing || 0,
            margin: m.margin || 0,
            columns: m.columns || 1,
            rows: m.rows || 1,
            total: m.total || 0,
        }
    }

    // Top-left pixel of a frame cell on the PNG.
    _cellPixel(col, row) {
        const g = this._grid()
        return {
            x: g.margin + col * (g.fw + g.spacing),
            y: g.margin + row * (g.fh + g.spacing),
        }
    }

    // Screen position of the view origin (the PNG's 0,0), including pan.
    _originScreen() {
        return { x: 24 - this.panX, y: this._contentTop() - this.panY }
    }

    _contentTop() { return 92 }

    // Screen point -> frame cell, or null if it falls outside the grid (in the
    // margin, in the spacing gutter, or off the sheet entirely).
    _cellAt(sx, sy) {
        const g = this._grid()
        const o = this._originScreen()
        const px = (sx - o.x) / this.zoom - g.margin
        const py = (sy - o.y) / this.zoom - g.margin
        if (px < 0 || py < 0) return null
        const col = Math.floor(px / (g.fw + g.spacing))
        const row = Math.floor(py / (g.fh + g.spacing))
        if (col < 0 || row < 0 || col >= g.columns || row >= g.rows) return null
        return { col, row }
    }

    frameIndex(col, row) { return row * this._grid().columns + col }

    // ---- lifecycle ---------------------------------------------------------

    // Open on a sheet. Returns false (and stays closed) for anything that isn't a
    // loaded, index-addressable spritesheet — images-mode packs and the legacy
    // Kenney catalog have no single PNG to draw.
    open(sheet) {
        const meta = (sheet && sheet.ref && sheet.ref._meta) || {}
        const mode = meta.mode || "spritesheet"
        if (!sheet || mode !== "spritesheet" || !meta.sheet) return false
        const tex = this.scene.textures.get(sheet.key)
        if (!tex || tex.key === "__MISSING") return false

        this.sheet = sheet
        this.panX = 0
        this.panY = 0
        this.zoom = this._fitZoom()
        this.visible = true
        this.root.setVisible(true)
        this._buildImage()
        this.render()
        return true
    }

    close() {
        this.visible = false
        this._drag = null
        this.root.setVisible(false)
    }

    // A zoom that shows the whole sheet width, capped so tiny sheets don't
    // balloon and huge ones stay legible (they scroll instead).
    _fitZoom() {
        const tex = this.scene.textures.get(this.sheet.key)
        const src = tex.getSourceImage && tex.getSourceImage()
        const w = (src && src.width) || 256
        const avail = this.scene.cameras.main.width - 48
        return Phaser.Math.Clamp(Math.floor(avail / w) || 1, MIN_ZOOM, 6)
    }

    _buildImage() {
        if (this.image) this.image.destroy()
        // Frame 0 of a spritesheet texture is one tile; __BASE is the whole PNG.
        this.image = this.scene.add.image(0, 0, this.sheet.key, "__BASE").setOrigin(0, 0)
        this.viewRoot.addAt(this.image, 0)
    }

    // ---- input -------------------------------------------------------------

    _bindInput() {
        const s = this.scene
        s.input.on("pointerdown", (p) => {
            if (!this.visible || !this.sheet) return
            if (p.y < this._contentTop() - 8) return           // header strip
            const cell = this._cellAt(p.x, p.y)
            if (!cell) return
            this._drag = { from: cell, to: cell }
            this.render()
        })
        s.input.on("pointermove", (p) => {
            if (!this.visible || !this.sheet) return
            const cell = this._cellAt(p.x, p.y)
            this._hover = cell
            if (this._drag && cell) this._drag.to = cell
            this.render()
        })
        s.input.on("pointerup", () => {
            if (!this.visible || !this.sheet || !this._drag) return
            const rect = this._dragRect()
            this._drag = null
            this.render()
            if (rect) this._commit(rect)
        })
        s.input.on("wheel", (p, over, dx, dy) => {
            if (!this.visible) return
            this.zoomBy(dy > 0 ? -1 : 1)
        })
    }

    // The drag as a normalized rect in frame units.
    _dragRect() {
        if (!this._drag) return null
        const { from, to } = this._drag
        const col = Math.min(from.col, to.col), row = Math.min(from.row, to.row)
        return {
            col, row,
            w: Math.abs(to.col - from.col) + 1,
            h: Math.abs(to.row - from.row) + 1,
        }
    }

    // Route a completed selection to the host. The rule that decides which UNIT
    // is being authored:
    //   1x1 inside an existing region -> edit that region (it's the thing you
    //       can see, so it's the thing you meant to click)
    //   1x1 elsewhere                 -> a per-frame label (terrain)
    //   anything larger               -> a region (object)
    _commit(rect) {
        const single = rect.w === 1 && rect.h === 1
        if (single) {
            const hit = this._regionAt(rect.col, rect.row)
            if (hit) return this.onEditRegion(hit)
            return this.onLabelFrame(rect.col, rect.row, this.frameIndex(rect.col, rect.row))
        }
        this.onCreateRegion(rect)
    }

    _regionAt(col, row) {
        for (const r of this.regions()) {
            if (col >= r.col && col < r.col + r.w && row >= r.row && row < r.row + r.h) return r
        }
        return null
    }

    zoomBy(delta) {
        if (!this.visible) return
        this.zoom = Phaser.Math.Clamp(this.zoom + delta, MIN_ZOOM, MAX_ZOOM)
        this._clampPan()
        this.render()
    }

    pan(dx, dy) {
        if (!this.visible) return
        this.panX += dx
        this.panY += dy
        this._clampPan()
        this.render()
    }

    toggleLabels() {
        this.showLabels = !this.showLabels
        this.render()
    }

    cycleBackdrop() {
        this.backdrop = (this.backdrop + 1) % BACKDROPS.length
        this.render()
    }

    _clampPan() {
        const tex = this.scene.textures.get(this.sheet.key)
        const src = tex.getSourceImage && tex.getSourceImage()
        const w = ((src && src.width) || 0) * this.zoom
        const h = ((src && src.height) || 0) * this.zoom
        const viewW = this.scene.cameras.main.width - 48
        const viewH = this.scene.cameras.main.height - this._contentTop() - 40
        this.panX = Phaser.Math.Clamp(this.panX, 0, Math.max(0, w - viewW))
        this.panY = Phaser.Math.Clamp(this.panY, 0, Math.max(0, h - viewH))
    }

    // ---- host seams --------------------------------------------------------
    // Overridden by AtlasScene, which owns the store. Defaults are inert so the
    // view is usable (as a grid verifier) without a label backend.

    regions() { return [] }                 // [{ name, col, row, w, h }]
    labelForFrame(frame) { return null }    // string | null
    onCreateRegion(rect) {}
    onEditRegion(region) {}
    onLabelFrame(col, row, frame) {}

    // ---- render ------------------------------------------------------------

    render() {
        if (!this.visible || !this.sheet) return
        const cam = this.scene.cameras.main
        const g = this._grid()
        const o = this._originScreen()

        this.bg.setSize(cam.width, cam.height).setPosition(0, 0)
            .setFillStyle(BACKDROPS[this.backdrop].color)
        this.viewRoot.setPosition(o.x, o.y)
        if (this.image) this.image.setScale(this.zoom)

        this._renderHeader()
        this._renderGrid(g)
        this._renderOverlay(g)
        this._renderText(g)
    }

    _renderHeader() {
        const cam = this.scene.cameras.main
        const g = this._grid()
        const tex = this.scene.textures.get(this.sheet.key)
        const src = tex.getSourceImage && tex.getSourceImage()
        const pw = (src && src.width) || 0, ph = (src && src.height) || 0

        this.headerText.setPosition(24, 14).setText(`SHEET VIEW — ${this.sheet.key}`)

        const meta = this._meta()
        const frameDesc = g.fw === g.fh ? `@${g.fw}` : `@${g.fw}x${g.fh}`
        this.metaText.setPosition(24, 38).setText(
            `${pw}x${ph}px  ·  ${g.columns}x${g.rows} ${frameDesc}` +
            (g.spacing ? ` sp${g.spacing}` : "") + (g.margin ? ` mg${g.margin}` : "") +
            `  ·  ${g.total || g.columns * g.rows} frames  ·  zoom ${this.zoom}x` +
            `  ·  bg ${BACKDROPS[this.backdrop].name}`
        )

        // The verify-before-label gate, made visible: does the declared grid
        // actually tile the PNG? An inexact fit means every label authored
        // against this grid is landing on the wrong pixels.
        const pitchW = g.fw + g.spacing, pitchH = g.fh + g.spacing
        const exactW = pw > 0 && (pw - 2 * g.margin + g.spacing) % pitchW === 0
        const exactH = ph > 0 && (ph - 2 * g.margin + g.spacing) % pitchH === 0
        const fitCols = Math.floor((pw - 2 * g.margin + g.spacing) / pitchW)
        const fitRows = Math.floor((ph - 2 * g.margin + g.spacing) / pitchH)
        const warns = []
        if (!exactW || !exactH) warns.push(`GRID DOES NOT DIVIDE THE PNG (fits ${fitCols}x${fitRows}) — fix _meta before labeling`)
        else if (fitCols !== g.columns || fitRows !== g.rows) warns.push(`declared ${g.columns}x${g.rows} but the PNG fits ${fitCols}x${fitRows}`)
        if (/VERIFY/i.test(meta.note || "")) warns.push("_meta still says VERIFY — confirm the lines land on tile edges, then update the note")
        this.warnText.setPosition(24, 56).setText(warns.join("   ·   "))

        this.hintText.setPosition(24, this.scene.cameras.main.height - 22).setText(
            "drag a block → name a REGION   ·   click a frame → LABEL it   ·   click a region → rename (blank deletes)   ·   " +
            "S back to catalog   ·   +/- zoom   ·   arrows pan   ·   L labels on/off   ·   B backdrop (check dark art for hidden shadow)"
        )
        this.cursorText.setPosition(cam.width - 16, 14)
    }

    _renderGrid(g) {
        const gfx = this.gridGfx
        gfx.clear()
        const z = this.zoom
        const pitchW = (g.fw + g.spacing) * z, pitchH = (g.fh + g.spacing) * z
        const m = g.margin * z
        const w = g.columns * pitchW - g.spacing * z
        const h = g.rows * pitchH - g.spacing * z

        for (let c = 0; c <= g.columns; c++) {
            const major = c % 5 === 0
            gfx.lineStyle(1, major ? COLOR_GRID_MAJOR : COLOR_GRID, major ? 0.75 : 0.35)
            const x = m + c * pitchW - (c === g.columns ? g.spacing * z : 0)
            gfx.lineBetween(x, m, x, m + h)
        }
        for (let r = 0; r <= g.rows; r++) {
            const major = r % 5 === 0
            gfx.lineStyle(1, major ? COLOR_GRID_MAJOR : COLOR_GRID, major ? 0.75 : 0.35)
            const y = m + r * pitchH - (r === g.rows ? g.spacing * z : 0)
            gfx.lineBetween(m, y, m + w, y)
        }
    }

    _rectScreen(col, row, w, h) {
        const g = this._grid()
        const z = this.zoom
        const p = this._cellPixel(col, row)
        return {
            x: p.x * z,
            y: p.y * z,
            w: (w * (g.fw + g.spacing) - g.spacing) * z,
            h: (h * (g.fh + g.spacing) - g.spacing) * z,
        }
    }

    _renderOverlay(g) {
        const gfx = this.overlayGfx
        gfx.clear()

        for (const r of this.regions()) {
            const s = this._rectScreen(r.col, r.row, r.w, r.h)
            gfx.fillStyle(COLOR_REGION_FILL, 0.12)
            gfx.fillRect(s.x, s.y, s.w, s.h)
            gfx.lineStyle(2, COLOR_REGION, 0.9)
            gfx.strokeRect(s.x, s.y, s.w, s.h)
        }

        if (this._hover && !this._drag) {
            const s = this._rectScreen(this._hover.col, this._hover.row, 1, 1)
            gfx.lineStyle(1, COLOR_HOVER, 0.6)
            gfx.strokeRect(s.x, s.y, s.w, s.h)
        }

        const drag = this._dragRect()
        if (drag) {
            const s = this._rectScreen(drag.col, drag.row, drag.w, drag.h)
            gfx.fillStyle(COLOR_SELECT, 0.15)
            gfx.fillRect(s.x, s.y, s.w, s.h)
            gfx.lineStyle(2, COLOR_SELECT, 1)
            gfx.strokeRect(s.x, s.y, s.w, s.h)
        }
    }

    _renderText(g) {
        this.textRoot.removeAll(true)

        // Region names ride the box. Always drawn — a region you can't read is a
        // region you'll author twice.
        for (const r of this.regions()) {
            const s = this._rectScreen(r.col, r.row, r.w, r.h)
            this.textRoot.add(this.scene.add.text(s.x + 2, s.y + 2, r.name, {
                font: "10px monospace", color: "#7dd3fc",
                backgroundColor: "#0b2a3a", padding: { x: 2, y: 1 },
            }))
        }

        // Per-frame labels, only when a cell is wide enough to hold text.
        const cellW = g.fw * this.zoom
        if (this.showLabels && cellW >= 40) {
            const cam = this.scene.cameras.main
            const o = this._originScreen()
            for (let row = 0; row < g.rows; row++) {
                for (let col = 0; col < g.columns; col++) {
                    const frame = this.frameIndex(col, row)
                    if (g.total && frame >= g.total) continue
                    const name = this.labelForFrame(frame)
                    if (!name) continue
                    const s = this._rectScreen(col, row, 1, 1)
                    // Cull offscreen text — a 900-frame sheet would otherwise build
                    // hundreds of Text objects per repaint.
                    const sy = o.y + s.y
                    if (sy < -40 || sy > cam.height + 40) continue
                    this.textRoot.add(this.scene.add.text(s.x + 1, s.y + s.h - 12, name, {
                        font: "9px monospace", color: "#0a0a0a",
                        backgroundColor: "#7fe0a0", padding: { x: 1, y: 0 },
                    }).setAlpha(0.9))
                }
            }
        }

        // Cursor readout: what the mouse is over, in every address the rest of the
        // system uses (position code, frame index, current label).
        if (this._hover) {
            const frame = this.frameIndex(this._hover.col, this._hover.row)
            const name = this.labelForFrame(frame)
            const drag = this._dragRect()
            const sel = drag && (drag.w > 1 || drag.h > 1) ? `   sel ${drag.w}x${drag.h} @ c${drag.col},r${drag.row}` : ""
            this.cursorText.setText(`c${this._hover.col},r${this._hover.row}  #${frame}${name ? `  "${name}"` : ""}${sel}`)
        } else {
            this.cursorText.setText("")
        }
    }
}
