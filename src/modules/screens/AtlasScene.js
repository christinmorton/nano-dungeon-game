import AssetBrowser, { CELL_W, COLS } from "./AssetBrowser.js"
import SHEETS from "../../data/assetSheets.js"
import { assetRefFromContext } from "../../data/assetRef.js"
import { loadTileLabels, saveTileLabels } from "./tileLabelsClient.js"
import SheetView from "./SheetView.js"
import { setTileLabelStore } from "../levels/tileLabelStore.js"

// AtlasScene — the asset browser as a tab inside the Dungeon Designer (design
// §15: fold the Tile Reference browser into the designer so authored floors are
// themed from real, verified art instead of guessed frame indices).
//
// Shares the AssetBrowser engine with the standalone reference page (TestScreen)
// so the two can't drift. Registered alongside DesignerScene in designerMain.js;
// starts inactive and is woken when the Atlas tab is selected.
//
// Two modes, selected by the `atlasPick` registry value the Layout screen sets:
//   - BROWSE (default): a click ADDS the tile to the COLLECTION — a staging
//     shelf drawn down the right edge of the browser (thumbnail + name; click an
//     entry to remove it). The collection lives in the shared registry under
//     `assetCollection` and rides the single dungeon JSON: DesignerScene folds it
//     into serialize()/deserialize(), so it persists via autosave and Export.
//   - PICK ('floor' | 'wall'): the theme pickers put us here. A click on a
//     usable tileset frame resolves it to a theme descriptor, emits it back to
//     the Layout screen on the game bus ('atlas:pick'), and returns to Layout.
//     Esc cancels. Only spritesheet packs with a loadable sheet path qualify —
//     the engine paints ONE tileset per floor, so image-mode packs and the
//     legacy Kenney catalog (no loadable key) are rejected.
//
// The collection panel reserves a fixed strip on the right; the shared base
// exposes _gridRightInset()/_gridCols() so the browse grid fits fewer columns
// and never draws under (or clicks through) the panel. TestScreen keeps its
// defaults (inset 0, COLS columns), so the standalone page is unaffected.

const PANEL_W = 260          // collection panel width (px)
const PANEL_GAP = 12         // gap between the browse grid and the panel
const THUMB = 40             // collection thumbnail size (px)
const ROW_H = 52             // collection row height (px)
const COLLECTION_KEY = "assetCollection"

const COLOR_PANEL_BG = 0x0d0c0a
const COLOR_PANEL_EDGE = 0x2a2a2a

export default class AtlasScene extends AssetBrowser {
    constructor() {
        super({ key: "Atlas", active: false })
        // Human tile labels ({ sheetKey: { frame: name } }), loaded from the dev
        // endpoint after create(). Initialized here so _labelFor (called during the
        // first renderGroup in super.create()) is always safe.
        this.tileLabels = {}
        // Named multi-frame regions ({ sheetKey: [ { name, col, row, w, h } ] }) —
        // the OBJECT unit, alongside the per-frame terrain unit above. Authored in
        // the sheet view (S), which is the only surface where a 3x4 building looks
        // like a building rather than 12 unrelated cells.
        this.tileRegions = {}
    }

    // Reserve the panel strip (+ a gap) on the right; the base keeps the grid,
    // desc wrap, and right-anchored chrome clear of it.
    _gridRightInset() { return PANEL_W + PANEL_GAP }

    // Fit as many columns as the remaining width allows, never more than the
    // base default (so wide canvases still cap at COLS and don't look sparse).
    _gridCols() {
        const avail = this.cameras.main.width - this._gridRightInset() - 24
        return Math.max(1, Math.min(COLS, Math.floor(avail / CELL_W)))
    }

    // The designer's authored items as the FIRST Atlas page (built from the shared
    // registry key the DesignerScene mirrors the archive into). Each item renders
    // from its own art sheet; art-less items get a placeholder. Clicking one edits
    // it (see onPick). Called during super.create() — before this.create() sets
    // _sheetByKey — so it builds the sheet map itself.
    _extraGroups() { return [this._buildAuthoredGroup()] }

    _buildAuthoredGroup() {
        const list = this.registry.get("authoredItems")
        const items = Array.isArray(list) ? list : []
        const byKey = this._sheetByKey || Object.fromEntries(SHEETS.map(s => [s.key, s]))
        const tiles = {}
        for (const it of items) {
            const art = it.art, e = (art && art.entry) || {}
            tiles[it.key] = (art && art.sheet && byKey[art.sheet])
                ? { sheet: byKey[art.sheet], tile: e.tile, frame: e.frame, file: e.file, externalAsset: e.externalAsset, frameIndex: e.frameIndex, label: it.name || it.key, _itemKey: it.key }
                : { label: it.name || it.key, _itemKey: it.key }   // no/unknown art → placeholder
        }
        return { name: "authored items", tiles, sheet: null, description: "Items you created in the Items tab. Click one to edit it." }
    }

    // Rebuild the authored-items page (index 0, since _extraGroups prepends it) and
    // repaint if it's the one on screen. Fired on registry change and on tab wake.
    _rebuildAuthoredGroup() {
        if (!this.groups || !this.groups.length) return
        this.groups[0] = this._buildAuthoredGroup()
        if (this.groupIndex === 0) this.renderGroup()
    }

    create() {
        super.create()

        // Sheet-by-key lookup so a stored collection item (which only keeps the
        // sheet KEY, not the live SHEETS object) can be re-rendered as a thumbnail.
        this._sheetByKey = Object.fromEntries(SHEETS.map(s => [s.key, s]))

        // The collection shelf — its own container above the grid/chrome so its
        // opaque background reads as a clean divider.
        this.collectionRoot = this.add.container(0, 0).setDepth(50)

        // Pick-mode banner (top-centre; only shown while a pick is pending).
        this.pickBanner = this.add.text(this.cameras.main.width / 2, 12, "", {
            font: "14px monospace",
            color: "#7dd3fc",
            backgroundColor: "#0b2a3a",
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5, 0).setDepth(100).setVisible(false)

        // Esc closes the sheet view first (it's the modal-most thing on screen),
        // otherwise cancels a pending pick.
        this.input.keyboard.on("keydown-ESC", () => {
            if (this.sheetView && this.sheetView.visible) return this._toggleSheetView()
            this._cancelPick()
        })
        // Re-check pick mode + repaint the collection + refresh the authored-items
        // page each time the tab wakes.
        this.events.on("wake", () => { this._refreshPickMode(); this._renderCollection(); this._rebuildAuthoredGroup() })

        // Repaint the shelf whenever the collection changes (a pick here, or a
        // load/import/New from DesignerScene, which write the same registry key).
        this.registry.events.on(`changedata-${COLLECTION_KEY}`, this._renderCollection, this)
        // Rebuild the authored-items page when the item archive changes.
        this.registry.events.on("changedata-authoredItems", this._rebuildAuthoredGroup, this)
        this.events.once("shutdown", () => {
            this.registry.events.off(`changedata-${COLLECTION_KEY}`, this._renderCollection, this)
            this.registry.events.off("changedata-authoredItems", this._rebuildAuthoredGroup, this)
        })

        // Right-click labels a tile (see onLabelTile) — suppress the browser menu.
        if (this.input.mouse) this.input.mouse.disableContextMenu()
        // Load the tile-label store, then repaint so labels appear on the grid.
        loadTileLabels().then(store => {
            this.tileLabels = (store && store.labels) || {}
            this.tileRegions = (store && store.regions) || {}
            // The endpoint reads the file off disk, so this is fresher than the
            // bundled snapshot whenever the JSON changed without a rebuild.
            setTileLabelStore({ labels: this.tileLabels, regions: this.tileRegions })
            if (this.groups && this.groups.length) this.renderGroup()
            if (this.sheetView && this.sheetView.visible) this.sheetView.render()
        })

        this._initSheetView()
        this._refreshPickMode()
        this._renderCollection()
    }

    // ---- sheet view (S) ----------------------------------------------------
    // The catalog grid reflows frames into padded columns, which cannot show a
    // multi-frame object as an object or a grid as it actually falls on the PNG.
    // The sheet view draws the raw sheet with its declared grid over it; this
    // wires it to the label store and to the browser's existing nav keys.

    _initSheetView() {
        const view = new SheetView(this)
        this.sheetView = view

        view.regions = () => (this.tileRegions[view.sheet.key] || [])
        view.labelForFrame = (frame) => this._labelFor(view.sheet && view.sheet.key, frame)
        view.onLabelFrame = (col, row, frame) => this._promptFrameLabel(view.sheet.key, frame, `c${col},r${row}`)
        view.onCreateRegion = (rect) => this._promptRegion(view.sheet.key, rect, null)
        view.onEditRegion = (region) => this._promptRegion(view.sheet.key, region, region)

        this.input.keyboard.on("keydown-S", () => this._toggleSheetView())
        this.input.keyboard.on("keydown-L", () => { if (view.visible) view.toggleLabels() })
        this.input.keyboard.on("keydown-B", () => { if (view.visible) view.cycleBackdrop() })
        // Zoom off the raw key so this doesn't depend on Phaser's PLUS/MINUS
        // keycode naming (which differs across layouts).
        this.input.keyboard.on("keydown", (ev) => {
            if (!view.visible) return
            if (ev.key === "+" || ev.key === "=") view.zoomBy(1)
            else if (ev.key === "-" || ev.key === "_") view.zoomBy(-1)
        })
    }

    _toggleSheetView() {
        const view = this.sheetView
        if (!view) return
        if (view.visible) {
            view.close()
            this._setCatalogVisible(true)
            return
        }
        const sheet = this._currentSheet()
        if (!sheet) { this._flash("this page has no single tileset PNG to show"); return }
        if (!view.open(sheet)) { this._flash(`can't draw ${sheet.key} as a sheet (image-mode or unloaded)`); return }
        this._setCatalogVisible(false)
    }

    // The sheet behind the CURRENT page. Synthetic pages (authored items) and the
    // legacy Kenney catalog have no one sheet, so they return null.
    _currentSheet() {
        const group = this.groups && this.groups[this.groupIndex]
        return (group && group.sheet) || null
    }

    // Hide the catalog while the sheet view is up. Invisible objects don't hit-test
    // in Phaser, so this also stops clicks falling through to the grid beneath.
    _setCatalogVisible(on) {
        if (this.contentRoot) this.contentRoot.setVisible(on)
        if (this.collectionRoot) this.collectionRoot.setVisible(on)
        for (const t of [this.headerText, this.metaText, this.descText, this.scrollIndicator, this.footerHint, this.footerBar]) {
            if (t) t.setVisible(on)
        }
    }

    // The sheet view covers the canvas, so page navigation (G) is suppressed
    // while it's open — you're looking at one sheet, not paging the catalog.
    _navLocked() { return !!(this.sheetView && this.sheetView.visible) }

    // Arrow/PgUp/Home keys are already bound by the base for catalog nav; while the
    // sheet view is up they pan it instead, so there's one set of movement keys.
    navigate(delta) {
        if (this.sheetView && this.sheetView.visible) return this.sheetView.pan(delta * 64, 0)
        super.navigate(delta)
    }

    scroll(delta) {
        if (this.sheetView && this.sheetView.visible) {
            const step = Number.isFinite(delta) ? delta : (delta > 0 ? 4000 : -4000)
            return this.sheetView.pan(0, step)
        }
        super.scroll(delta)
    }

    // ---- tile labels (right-click a frame to name it) ----------------------

    // Human label for a frame, or null. Read by AssetBrowser.renderGroup so a
    // browse-all-frames sheet shows names ("grass", "wall") beside its r{r}_c{c}
    // position codes. `key` is the frame index (spritesheet) or file (images).
    _labelFor(sheetKey, key) {
        if (!sheetKey || key == null) return null
        const forSheet = this.tileLabels[sheetKey]
        return (forSheet && forSheet[String(key)]) || null
    }

    // Right-click handler from the base grid: prompt to (re)name the frame and
    // persist it. Blank input clears the label. Frame key is the spritesheet frame
    // index, else the images-mode file.
    onLabelTile(ctx) {
        const sheetKey = ctx && ctx.sheet && ctx.sheet.key
        const entry = (ctx && ctx.entry) || {}
        const key = entry.frame ?? entry.tile ?? entry.file
        if (!sheetKey || key == null) { this._flash("can't label this tile"); return }
        this._promptFrameLabel(sheetKey, key)
    }

    // Name one frame. Shared by the catalog's right-click and the sheet view's
    // single-frame click, so the two surfaces can't drift on what a label is.
    // `where` is an optional position hint for the prompt (the sheet view knows
    // the col/row; the catalog only knows the index).
    _promptFrameLabel(sheetKey, key, where) {
        const current = this._labelFor(sheetKey, key) || ""
        const at = where ? ` (${where})` : ""
        const input = window.prompt(
            `Label for ${sheetKey} #${key}${at}\n\n` +
            `Terrain uses "<terrain>:<dir>" with dir one of: nw n ne w c e sw s se\n` +
            `(a terrain needs all nine to become selectable; any other token is ignored)`,
            current
        )
        if (input === null) return                       // cancelled
        const label = input.trim()
        if (!this.tileLabels[sheetKey]) this.tileLabels[sheetKey] = {}
        if (label) this.tileLabels[sheetKey][String(key)] = label
        else {
            delete this.tileLabels[sheetKey][String(key)]
            if (!Object.keys(this.tileLabels[sheetKey]).length) delete this.tileLabels[sheetKey]
        }
        this._persist()
        this._flash(label ? `labeled ${sheetKey} #${key} = "${label}"` : `cleared ${sheetKey} #${key}`)
    }

    // Create or edit a named region. `existing` non-null means we're editing that
    // region in place (blank name deletes it); otherwise `rect` is a fresh
    // selection to name. Regions are stored in FRAME units so they survive any
    // correct grid — never as pixels, and never by rewriting frame indices.
    _promptRegion(sheetKey, rect, existing) {
        const size = `${rect.w}x${rect.h} @ c${rect.col},r${rect.row}`
        const input = window.prompt(
            existing
                ? `Rename region "${existing.name}" (${size})\n\nBlank deletes it.`
                : `Name this ${size} region on ${sheetKey}\n\n` +
                  `One name for the whole object (e.g. "cottage-red", "oak-tree", "fountain").`,
            existing ? existing.name : ""
        )
        if (input === null) return
        const name = input.trim()
        const list = this.tileRegions[sheetKey] || []

        if (existing) {
            const next = name
                ? list.map(r => (r === existing ? { ...r, name } : r))
                : list.filter(r => r !== existing)
            this._setRegions(sheetKey, next)
            this._flash(name ? `renamed region → "${name}"` : `deleted region "${existing.name}"`)
        } else {
            if (!name) return
            this._setRegions(sheetKey, [...list, { name, col: rect.col, row: rect.row, w: rect.w, h: rect.h }])
            this._flash(`region "${name}" = ${size}`)
        }
        if (this.sheetView) this.sheetView.render()
    }

    _setRegions(sheetKey, list) {
        if (list.length) this.tileRegions[sheetKey] = list
        else delete this.tileRegions[sheetKey]
        this._persist()
    }

    // Write the whole store (both units), publish it to the LIVE store, and
    // repaint the catalog.
    //
    // The publish is what removes the page reload. autotile.js / tileRegions.js
    // otherwise read the JSON snapshot bundled at boot, so a terrain renamed here
    // stayed renamed only inside the Atlas — the Floor-theme "Autotile ground"
    // dropdown and MapState's painting kept serving the old names until F5.
    // Pushed AFTER the write is queued, not awaited: the in-memory object is the
    // one everything reads, and blocking the UI on a disk round-trip would make
    // every rename feel slow.
    _persist() {
        saveTileLabels(this.tileLabels, this.tileRegions)
        setTileLabelStore({ labels: this.tileLabels, regions: this.tileRegions })
        this.renderGroup()
    }

    // Keep the banner centred and repaint the shelf when the canvas resizes
    // (the base handles the grid + chrome).
    _onResize() {
        super._onResize()
        if (this.pickBanner) this.pickBanner.setX(this.cameras.main.width / 2)
        this._renderCollection()
        if (this.sheetView && this.sheetView.visible) {
            this.sheetView.render()
            this._setCatalogVisible(false)   // super._onResize repaints the grid
        }
    }

    // ---- collection (registry-backed; DesignerScene owns persistence) --------

    _collection() {
        const c = this.registry.get(COLLECTION_KEY)
        return Array.isArray(c) ? c : []
    }

    // Store a NEW array each time so the changedata event fires and the shelf
    // repaints. Items keep only serializable fields (no live sheet reference).
    _addToCollection(path, ctx) {
        const cur = this._collection()
        if (cur.some(it => it.path === path)) { this._flash(`already collected: ${ctx.tileName}`); return }
        // Same canonical asset-reference shape the general "pick asset" flow returns
        // (data/assetRef.js) so the collection and picks can't drift.
        const item = assetRefFromContext(path, ctx)
        this.registry.set(COLLECTION_KEY, [...cur, item])
        this._flash(`added: ${ctx.tileName}`)
    }

    _removeFromCollection(path) {
        this.registry.set(COLLECTION_KEY, this._collection().filter(it => it.path !== path))
    }

    // Transient bottom-of-canvas feedback. The base owns the implementation now;
    // this name is kept because the labeling paths read better with it.
    _flash(msg) { this._notify(msg) }

    _renderCollection() {
        if (!this.collectionRoot) return
        this.collectionRoot.removeAll(true)

        const W = this.cameras.main.width, H = this.cameras.main.height
        const panelX = W - PANEL_W
        const items = this._collection()

        // Background + left divider.
        this.collectionRoot.add(this.add.rectangle(panelX, 0, PANEL_W, H, COLOR_PANEL_BG).setOrigin(0, 0))
        this.collectionRoot.add(this.add.rectangle(panelX, 0, 1, H, COLOR_PANEL_EDGE).setOrigin(0, 0))

        this.collectionRoot.add(this.add.text(panelX + 12, 12, `COLLECTION (${items.length})`, {
            font: "14px monospace", color: "#facc15"
        }))
        this.collectionRoot.add(this.add.text(panelX + 12, 32, "click a tile to add · click a row to remove", {
            font: "10px monospace", color: "#7a7466",
            wordWrap: { width: PANEL_W - 24 }
        }))

        if (!items.length) {
            this.collectionRoot.add(this.add.text(panelX + 12, 60, "No tiles yet.", {
                font: "12px monospace", color: "#7a7466"
            }))
            return
        }

        const startY = 60
        const maxRows = Math.max(1, Math.floor((H - startY - 16) / ROW_H))
        const overflow = items.length > maxRows
        const shown = overflow ? maxRows - 1 : items.length   // reserve last row for "+N more"

        for (let i = 0; i < shown; i++) {
            const item = items[i]
            const rowY = startY + i * ROW_H

            // Row hit target — click anywhere on the row to remove it.
            const hit = this.add.rectangle(panelX + 4, rowY, PANEL_W - 8, ROW_H - 4, 0xffffff, 0)
                .setOrigin(0, 0)
                .setInteractive({ useHandCursor: true })
            hit.on("pointerover", () => hit.setFillStyle(0xffffff, 0.05))
            hit.on("pointerout", () => hit.setFillStyle(0xffffff, 0))
            hit.on("pointerdown", () => this._removeFromCollection(item.path))
            this.collectionRoot.add(hit)

            const thumb = this._makeThumb(item, panelX + 12, rowY + 4)
            if (thumb) this.collectionRoot.add(thumb)

            this.collectionRoot.add(this.add.text(panelX + 12 + THUMB + 10, rowY + 6, item.name, {
                font: "11px monospace", color: "#ffffff",
                wordWrap: { width: PANEL_W - THUMB - 46 }
            }))
            this.collectionRoot.add(this.add.text(panelX + PANEL_W - 16, rowY + 6, "✕", {
                font: "12px monospace", color: "#7a7466"
            }).setOrigin(1, 0))
        }

        if (overflow) {
            this.collectionRoot.add(this.add.text(panelX + 12, startY + shown * ROW_H + 4,
                `+${items.length - shown} more (Export to see all)`, {
                    font: "11px monospace", color: "#7a7466"
                }))
        }
    }

    // Build a thumbnail sprite for a stored item, scaled to THUMB px. Mirrors the
    // grid's sprite path (resolveSprite) but from the persisted sheet key + entry.
    _makeThumb(item, x, y) {
        const sheet = this._sheetByKey[item.sheet]
        if (!sheet) return null
        const { spriteKey, frame, isImage } = this.resolveSprite(sheet, item.entry || {})
        const tex = this.textures.get(spriteKey)
        if (!tex || tex.key === "__MISSING") return null
        let sourceW = 16
        if (isImage) {
            const src = tex.getSourceImage && tex.getSourceImage()
            sourceW = src && src.width ? src.width : (sheet.ref._meta?.tileSize || 64)
        } else {
            const sf = tex.get(frame)
            sourceW = sf ? sf.width : 16
        }
        const sprite = (isImage
            ? this.add.sprite(x, y, spriteKey)
            : this.add.sprite(x, y, spriteKey, frame))
            .setOrigin(0, 0)
            .setScale(THUMB / sourceW)
        return sprite
    }

    // ---- pick mode (theme picker; unchanged) --------------------------------

    _pickTarget() {
        return this.registry.get("atlasPick") || null
    }

    _refreshPickMode() {
        if (!this.pickBanner) return
        const target = this._pickTarget()
        if (target) {
            this.pickBanner.setText(`PICK MODE — click a ${target.toUpperCase()} tile   ·   Esc to cancel`).setVisible(true)
        } else {
            this.pickBanner.setVisible(false)
        }
    }

    // The tab a pick returns to — the one the picker was started from, so a pick
    // lands you back where you were. A requester may pin one via
    // `atlasPickReturn` (the general asset pick uses this so it can be triggered
    // from any tab); otherwise it follows the control's home: the Goal picker on
    // the Dungeon tab, the floor/wall theme lists on the Decorate rail.
    _returnTabFor(target) {
        const pinned = this.registry.get("atlasPickReturn")
        if (pinned) return pinned
        if (target === "goal") return "dungeon"
        if (target === "floor" || target === "wall") return "decorate"
        return "layout"
    }

    _cancelPick() {
        const target = this._pickTarget()
        if (!target) return
        this.registry.set("atlasPick", null)
        this._refreshPickMode()
        if (this.game.showTab) this.game.showTab(this._returnTabFor(target))
        this.registry.set("atlasPickReturn", null)
    }

    // BROWSE → add to the collection. PICK → resolve the frame + return the pick
    // to whichever screen requested it (floor/wall theme, or the goal item).
    onPick(path, ctx) {
        // An authored item (the Items group) → edit it, regardless of pick mode.
        if (ctx.entry && ctx.entry._itemKey) {
            this.game.events.emit("designer:editItem", ctx.entry._itemKey)
            if (this.game.showTab) this.game.showTab("items")
            return
        }
        const target = this._pickTarget()
        if (!target) return this._addToCollection(path, ctx)

        // General "pick asset" (the asset-reference primitive): return the FULL
        // reference for ANY renderable asset — no spritesheet-only restriction,
        // since props / items can be image-mode art too. Theme + goal below stay
        // as specializations that further require a paintable tileset frame.
        if (target === "asset") {
            const ref = assetRefFromContext(path, ctx)
            this.registry.set("atlasPick", null)
            this._refreshPickMode()
            this.game.events.emit("atlas:pick", { target: "asset", ref })
            if (this.game.showTab) this.game.showTab(this._returnTabFor(target))
            this.registry.set("atlasPickReturn", null)
            return
        }

        const sheet = ctx.sheet
        const meta = (sheet.ref && sheet.ref._meta) || {}
        const mode = meta.mode || "spritesheet"
        // Only real, loadable spritesheets resolve to a { sheet, frame } the game
        // can paint. Image-mode packs and the legacy Kenney catalog (no loadable
        // sheet path) are rejected for both theme and goal picks.
        if (mode !== "spritesheet" || !meta.sheet) {
            this.copyToClipboard("pick a tileset frame (this pack can't be used here)")
            return
        }
        const frame = ctx.entry.tile ?? ctx.entry.frame
        if (frame == null) {
            this.copyToClipboard("no frame index on that tile — pick another")
            return
        }

        this.registry.set("atlasPick", null)
        this._refreshPickMode()
        this.game.events.emit("atlas:pick", {
            target,
            sheet: sheet.key,
            frame,
            name: ctx.tileName,               // used by the goal picker
            tileSize: meta.tileSize || 16,     // used by the theme picker
            spacing: meta.spacing || 0,
            margin: meta.margin || 0,
        })
        if (this.game.showTab) this.game.showTab(this._returnTabFor(target))
    }
}
