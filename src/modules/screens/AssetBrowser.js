import Phaser from "phaser"
import SHEETS from "../../data/assetSheets.js"

// AssetBrowser — the shared art-catalog browser (design §15: fold test.html into
// the designer). One browser, two hosts: the standalone Tile Reference page
// (TestScreen, fixed size) and the designer's Atlas tab (AtlasScene, resizable).
// Same discipline as the shared level generator — extract the engine so the two
// can't drift.
//
// It loads every sheet in data/assetSheets.js, flattens the tileReference.*.json
// catalogs into browsable groups, and renders a scrollable grid of sprites you
// page through. A click fires onPick(path, ctx) — the ONE seam the two hosts
// differ on: the reference page copies the tile path; the Atlas (later) returns
// the selection to a theme field. Default onPick = copy to clipboard.
//
// Subclass and pass the scene key/active flag via super(config); override
// onPick() to change what a click does. Everything else (load, layout, nav,
// resize reflow) is inherited.

const TILE_SCALE = 4
const TILE_W = 16 * TILE_SCALE
export const CELL_W = TILE_W + 36
const CELL_H = TILE_W + 56
export const COLS = 12

const COLOR_HEADER = "#facc15"
const COLOR_DESC = "#cfc6b8"
const COLOR_LABEL = "#ffffff"
const COLOR_DIM = "#7a7466"
const COLOR_AUDIT = "#ff8a65"
const COLOR_NAMED = "#7fe0a0"   // a frame carrying a human tile-label (Atlas)

const SKIP_TOP_KEYS = new Set(["_meta", "anchors", "avoid"])

// The Phaser spritesheet config for a sheet's _meta. Kept in ONE place because
// the browser and the game must slice a PNG identically — MapState.js passes
// `theme.margin` into addTilesetImage, so a sheet with an outer margin painted
// correctly in-game while the Atlas rendered it shifted by `margin` px, showing
// a different grid than the one being labeled against.
//
// `tileSize` is the square default; a sheet with non-square frames (an animation
// strip like traps/spiketrap.png, 80x32 in two 40x32 frames) declares
// frameWidth/frameHeight instead, which `tileSize` alone cannot express.
export function frameConfig(meta) {
    const size = meta.tileSize || 16
    return {
        frameWidth: meta.frameWidth || size,
        frameHeight: meta.frameHeight || size,
        spacing: meta.spacing || 0,
        margin: meta.margin || 0,
    }
}

// Does an entry dict look like a group of renderable tiles?
function isTileGroup(val) {
    if (!val || typeof val !== "object" || Array.isArray(val)) return false
    const first = Object.values(val)[0]
    return (
        first &&
        typeof first === "object" &&
        ("tile" in first || "frame" in first || "file" in first || "externalAsset" in first)
    )
}

// Flatten every sheet in the index into a flat list of browsable groups. Each group carries
// the `sheet` it came from so the renderer knows how to load/scale it. Group names are
// prefixed with the sheet key so the catalog reads unambiguously across packs.
function buildGroups(sheets) {
    const groups = []
    for (const sheet of sheets) {
        const ref = sheet.ref
        const meta = ref._meta || {}

        // Sheets with browseAllFrames: synthesize one group of ALL frames by index
        // (position labels r{row}_c{col}). Does NOT `continue` — so a sheet may ALSO
        // carry named label groups (e.g. a "labels" group naming the useful tiles:
        // grass/wall/path), which the loop below emits alongside the full grid. This
        // keeps the by-index browse while adding human labels for palette authoring.
        if (meta.browseAllFrames) {
            const cols = meta.columns || 1
            const total = meta.total || 0
            const tiles = {}
            for (let i = 0; i < total; i++) {
                const r = Math.floor(i / cols)
                const c = i % cols
                tiles[`r${r}_c${c}`] = { frame: i }
            }
            groups.push({ name: sheet.key, tiles, sheet, description: meta.note })
            // fall through to also emit any named label groups on this sheet
        }

        for (const [groupName, val] of Object.entries(ref)) {
            if (SKIP_TOP_KEYS.has(groupName)) continue

            // Kenney legacy: regions hold nested named-entry dicts under region.tiles.
            if (groupName === "regions") {
                for (const [regionName, region] of Object.entries(val)) {
                    if (region && region.tiles && isTileGroup(region.tiles)) {
                        groups.push({
                            name: `${sheet.key}.regions.${regionName}`,
                            tiles: region.tiles,
                            sheet,
                            description: region.description,
                            shape: region.shape,
                            size: region.size
                        })
                    }
                }
                continue
            }

            if (isTileGroup(val)) {
                groups.push({ name: `${sheet.key}.${groupName}`, tiles: val, sheet })
            }
        }
    }
    return groups
}

export default class AssetBrowser extends Phaser.Scene {
    preload() {
        for (const sheet of SHEETS) {
            const meta = sheet.ref._meta || {}
            const mode = meta.mode || "spritesheet"

            if (mode === "images") {
                // Each entry names an individual PNG under _meta.dir; load each once.
                const seen = new Set()
                for (const [groupName, group] of Object.entries(sheet.ref)) {
                    if (SKIP_TOP_KEYS.has(groupName) || !group || typeof group !== "object") continue
                    for (const entry of Object.values(group)) {
                        if (entry && entry.file && !seen.has(entry.file)) {
                            seen.add(entry.file)
                            this.load.image(`${sheet.key}:${entry.file}`, `${meta.dir}/${entry.file}`)
                        }
                    }
                }
            } else if (meta.sheet) {
                this.load.spritesheet(sheet.key, meta.sheet, frameConfig(meta))
            }

            // Off-sheet single assets registered on the Kenney file (e.g. the lightning effect).
            const externalAssets = meta.externalAssets || {}
            for (const [key, asset] of Object.entries(externalAssets)) {
                const m = (asset.frameSize || "").match(/(\d+)\s*x\s*(\d+)/)
                this.load.spritesheet(key, asset.path, {
                    frameWidth: m ? parseInt(m[1]) : 64,
                    frameHeight: m ? parseInt(m[2]) : 64
                })
            }
        }
    }

    create() {
        // Synthetic groups (a host may inject) come FIRST, then the catalogs.
        this.groups = [...this._extraGroups(), ...buildGroups(SHEETS)]
        this.groupIndex = 0
        this.scrollY = 0

        this.headerText = this.add.text(20, 16, "", {
            font: "22px monospace",
            color: COLOR_HEADER
        })
        this.metaText = this.add.text(20, 44, "", {
            font: "13px monospace",
            color: COLOR_DIM
        })
        this.descText = this.add.text(20, 64, "", {
            font: "13px monospace",
            color: COLOR_DESC,
            wordWrap: { width: this.cameras.main.width - this._gridRightInset() - 40 }
        })

        this.contentRoot = this.add.container(0, 0)

        // Bottom chrome — kept as fields so resize can reposition them.
        this.footerBar = this.add.rectangle(0, 0, 10, 28, 0x000000).setOrigin(0, 0)
        this.footerHint = this.add.text(
            12, 0,
            "← / → groups   G jump to page   ↑ / ↓ scroll   PgUp / PgDn fast   Home top   End bottom",
            { font: "12px monospace", color: COLOR_DIM }
        )
        this.scrollIndicator = this.add.text(0, 0, "", { font: "12px monospace", color: COLOR_HEADER }).setOrigin(1, 0)
        this.copyFeedback = this.add.text(0, 0, "", { font: "12px monospace", color: "#a3e635" }).setOrigin(0.5, 0)

        this._bindKeys()
        this._layoutChrome()
        this.renderGroup()

        // Reflow on canvas resize (the designer's Atlas tab is RESIZE-scaled; the
        // standalone reference page is fixed, so this simply never fires there).
        this.scale.on("resize", this._onResize, this)
        this.events.once("shutdown", () => this.scale.off("resize", this._onResize, this))
    }

    _bindKeys() {
        this.input.keyboard.on("keydown-LEFT", () => this.navigate(-1))
        this.input.keyboard.on("keydown-RIGHT", () => this.navigate(1))
        this.input.keyboard.on("keydown-G", () => this.jumpToPage())
        this.input.keyboard.on("keydown-UP", () => this.scroll(-CELL_H))
        this.input.keyboard.on("keydown-DOWN", () => this.scroll(CELL_H))
        this.input.keyboard.on("keydown-PAGE_UP", () => this.scroll(-CELL_H * 4))
        this.input.keyboard.on("keydown-PAGE_DOWN", () => this.scroll(CELL_H * 4))
        this.input.keyboard.on("keydown-HOME", () => this.scroll(-Infinity))
        this.input.keyboard.on("keydown-END", () => this.scroll(Infinity))
    }

    // --- layout seams (overridable) -----------------------------------------
    // Width reserved on the RIGHT edge that the browse area must not draw into —
    // the Atlas tab uses it for its collection panel. Default 0: the standalone
    // reference page (TestScreen) is unaffected.
    _gridRightInset() { return 0 }
    // Number of grid columns. Default is the fixed COLS (TestScreen keeps its
    // layout); a host that reserves right-edge space overrides this to fit fewer.
    _gridCols() { return COLS }
    // Extra synthetic groups PREPENDED before the catalog groups (so they're the
    // first pages). Default none — TestScreen shows only the catalogs. The Atlas
    // overrides this to inject the designer's authored-items group; its entries
    // carry their own `sheet` + a `label` + `_itemKey` (see renderGroup / onPick).
    _extraGroups() { return [] }

    // Reposition the width/height-anchored chrome for the current canvas size.
    _layoutChrome() {
        if (!this.footerBar) return   // a resize can arrive before create() builds the chrome
        const W = this.cameras.main.width, H = this.cameras.main.height
        const inset = this._gridRightInset()
        this.descText.setWordWrapWidth(W - inset - 40)
        this.footerBar.setSize(W, 28).setPosition(0, H - 28)
        this.footerHint.setPosition(12, H - 22)
        // Keep the right-anchored readouts clear of the reserved right strip.
        this.scrollIndicator.setPosition(W - inset - 12, H - 22)
        this.copyFeedback.setPosition((W - inset) / 2, H - 22)
    }

    _onResize() {
        if (!this.contentRoot) return   // ignore resizes that arrive before create()
        this._layoutChrome()
        this.renderGroup()
    }

    navigate(delta) {
        const n = this.groups.length
        this._gotoGroup((this.groupIndex + delta + n) % n)
    }

    _gotoGroup(index) {
        this.groupIndex = index
        this.scrollY = 0
        this.renderGroup()
    }

    // Jump straight to a page. Arrow-stepping is fine for a handful of groups and
    // useless across ~150 of them (every registered sheet contributes at least
    // one), so this takes either a page NUMBER or part of a name.
    //
    // A name search resolves to the first match AFTER the current page and wraps,
    // so pressing G with the same query repeatedly walks every match instead of
    // sticking on the first one — the way you actually browse a pack's several
    // groups.
    jumpToPage() {
        if (this._navLocked() || this._typingInDom()) return
        const total = this.groups.length
        const here = this.groups[this.groupIndex]
        const answer = window.prompt(
            `Jump to page — a number (1-${total}), or part of a sheet/group name.\n\n` +
            `Currently ${this.groupIndex + 1}/${total}: ${here ? here.name : "?"}`,
            ""
        )
        if (answer === null) return
        const query = answer.trim()
        if (!query) return

        if (/^\d+$/.test(query)) {
            const n = parseInt(query, 10)
            if (n < 1 || n > total) return this._notify(`no page ${n} — range is 1-${total}`)
            return this._gotoGroup(n - 1)
        }

        const needle = query.toLowerCase()
        for (let i = 1; i <= total; i++) {
            const idx = (this.groupIndex + i) % total
            if (this.groups[idx].name.toLowerCase().includes(needle)) {
                this._gotoGroup(idx)
                return this._notify(`page ${idx + 1}/${total}: ${this.groups[idx].name}`)
            }
        }
        this._notify(`no page matching "${query}"`)
    }

    // Transient bottom-of-canvas message. Depth-raised so it stays readable over
    // anything a host draws on top (the Atlas sheet view covers the canvas).
    _notify(msg) {
        if (!this.copyFeedback) return
        this.copyFeedback.setDepth(300).setText(msg)
        if (this._copyFeedbackTimer) this._copyFeedbackTimer.remove()
        this._copyFeedbackTimer = this.time.delayedCall(2000, () => {
            if (this.copyFeedback) this.copyFeedback.setText("")
        })
    }

    // Hosts that put a modal surface over the browser override this so page keys
    // don't fire underneath it.
    _navLocked() { return false }

    // Phaser listens on the window, so a bare letter key would also fire while
    // you're typing in one of the designer's DOM fields. Harmless today (the
    // Atlas tab hides those panels) but a trap for any future overlay.
    _typingInDom() {
        const el = typeof document !== "undefined" && document.activeElement
        if (!el) return false
        const tag = (el.tagName || "").toLowerCase()
        return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable === true
    }

    scroll(delta) {
        const n = this._lastTileCount || 0
        const rows = Math.ceil(n / this._gridCols())
        const contentHeight = rows * CELL_H
        const visibleHeight = this.cameras.main.height - this._gridTop - 40
        const maxScroll = Math.max(0, contentHeight - visibleHeight)
        if (delta === -Infinity) {
            this.scrollY = 0
        } else if (delta === Infinity) {
            this.scrollY = maxScroll
        } else {
            this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, maxScroll)
        }
        this.contentRoot.y = -this.scrollY
        this.updateScrollIndicator(maxScroll)
    }

    copyToClipboard(text) {
        const showFeedback = (msg) => {
            if (!this.copyFeedback) return
            this.copyFeedback.setText(msg)
            if (this._copyFeedbackTimer) this._copyFeedbackTimer.remove()
            this._copyFeedbackTimer = this.time.delayedCall(2000, () => {
                if (this.copyFeedback) this.copyFeedback.setText("")
            })
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => showFeedback(`copied: ${text}`))
                .catch(() => showFeedback(`copy failed — ${text}`))
        } else {
            showFeedback(`copy unavailable — ${text}`)
        }
    }

    // What a tile click does. Default: copy its catalog path. Subclasses (the
    // Atlas theme picker) override to return the selection instead. `ctx` carries
    // the sheet, the raw catalog entry, the tile name, and its full path.
    onPick(path, ctx) {
        this.copyToClipboard(path)
    }

    // Right-click a tile. Default no-op; the Atlas overrides it to name the frame
    // (write to the tile-label store). Kept out of the base so TestScreen is
    // unaffected.
    onLabelTile(ctx) {}

    // The human label for a frame, by (sheetKey, frame-or-file). Default none; the
    // Atlas overrides it from the tile-label store so a browse-all-frames sheet can
    // show real names ("grass", "wall") next to its position codes.
    _labelFor(sheetKey, key) { return null }

    updateScrollIndicator(maxScroll) {
        if (!this.scrollIndicator) return
        if (maxScroll <= 0) {
            this.scrollIndicator.setText("")
            return
        }
        const pct = Math.round((this.scrollY / maxScroll) * 100)
        const visibleTop = Math.floor(this.scrollY / CELL_H) + 1
        const totalRows = Math.ceil((this._lastTileCount || 0) / this._gridCols())
        this.scrollIndicator.setText(`scroll ${pct}%   (row ${visibleTop} of ${totalRows})`)
    }

    // Resolve an entry to { spriteKey, frame, isImage } for whichever sheet/mode it belongs to.
    resolveSprite(sheet, entry) {
        const meta = sheet.ref._meta || {}
        const mode = meta.mode || "spritesheet"
        if (entry.externalAsset) {
            return { spriteKey: entry.externalAsset, frame: entry.frameIndex || 0, isImage: false }
        }
        if (mode === "images") {
            // Individual PNG (load.image) — single "__BASE" frame; never index by number.
            return { spriteKey: `${sheet.key}:${entry.file}`, frame: undefined, isImage: true }
        }
        // spritesheet — Kenney legacy entries use `tile`, new sheets use `frame`.
        return { spriteKey: sheet.key, frame: entry.tile ?? entry.frame ?? 0, isImage: false }
    }

    renderGroup() {
        this.contentRoot.removeAll(true)

        const group = this.groups[this.groupIndex]
        const tiles = Object.entries(group.tiles)

        this.headerText.setText(`${group.name}   (${this.groupIndex + 1}/${this.groups.length})`)

        const metaParts = [`${tiles.length} tiles`]
        if (group.size) metaParts.push(group.size)
        if (group.shape) metaParts.push(group.shape)
        this.metaText.setText(metaParts.join("  ·  "))

        this.descText.setText(group.description || "")
        const descBottom = this.descText.y + this.descText.height
        this._gridTop = Math.max(110, descBottom + 16)

        this.contentRoot.y = 0
        this.scrollY = 0

        const fullPath = (name) => `${group.name}.${name}`
        const cols = this._gridCols()

        tiles.forEach(([tileName, tileData], i) => {
            const col = i % cols
            const row = Math.floor(i / cols)
            const cx = 24 + col * CELL_W
            const cy = this._gridTop + row * CELL_H

            const hitZone = this.add.rectangle(cx, cy, CELL_W, CELL_H, 0xffffff, 0)
                .setOrigin(0, 0)
                .setInteractive({ useHandCursor: true })

            // An entry may carry its OWN sheet (synthetic groups whose entries come
            // from different packs — the designer's authored-items group); otherwise
            // it shares the group's sheet (the catalog case). An entry with no art
            // fields (a just-created item) or an unresolvable texture renders a
            // placeholder box so it still appears and stays clickable.
            const entrySheet = tileData.sheet || group.sheet
            const hasArt = tileData.tile != null || tileData.frame != null || tileData.file != null || tileData.externalAsset != null
            let placed = null
            if (entrySheet && hasArt) {
                const { spriteKey, frame, isImage } = this.resolveSprite(entrySheet, tileData)
                const tex = this.textures.get(spriteKey)
                if (tex && tex.key !== "__MISSING") {
                    if (isImage) {
                        const src = tex.getSourceImage && tex.getSourceImage()
                        const sourceW = src && src.width ? src.width : (entrySheet.ref._meta?.tileSize || 64)
                        placed = this.add.sprite(cx, cy, spriteKey).setOrigin(0, 0).setScale(TILE_W / sourceW)
                    } else {
                        const sf = tex.get(frame)
                        if (sf && String(sf.name) === String(frame)) {
                            placed = this.add.sprite(cx, cy, spriteKey, frame).setOrigin(0, 0).setScale(TILE_W / (sf.width || 16))
                        }
                    }
                }
            }
            if (placed) {
                this.contentRoot.add(placed)
            } else {
                const box = this.add.rectangle(cx, cy, TILE_W, TILE_W, 0x1a1712).setOrigin(0, 0).setStrokeStyle(1, 0x3a3630)
                const q = this.add.text(cx + TILE_W / 2, cy + TILE_W / 2, "?", { font: "20px monospace", color: COLOR_DIM }).setOrigin(0.5)
                this.contentRoot.add([box, q])
            }

            const idLabel = tileData.file
                ? tileData.file
                : tileData.externalAsset
                    ? `${tileData.externalAsset}#${tileData.frameIndex || 0}`
                    : (tileData.tile == null && tileData.frame == null)
                        ? ""
                        : `#${tileData.tile ?? tileData.frame ?? 0}`
            const idText = this.add.text(cx + TILE_W / 2, cy + TILE_W + 2, idLabel, {
                font: "10px monospace",
                color: COLOR_DIM
            }).setOrigin(0.5, 0)

            // A human label for this frame from the tile-label store (Atlas
            // override) wins over the entry's own label / the position code.
            const labelKey = (tileData.frame ?? tileData.tile)
            const customLabel = this._labelFor(entrySheet && entrySheet.key, labelKey != null ? labelKey : tileData.file)
            const nameText = this.add.text(cx + TILE_W / 2, cy + TILE_W + 16, customLabel || tileData.label || tileName, {
                font: "11px monospace",
                color: customLabel ? COLOR_NAMED : (tileData.audit ? COLOR_AUDIT : COLOR_LABEL),
                wordWrap: { width: CELL_W - 4 },
                align: "center"
            }).setOrigin(0.5, 0)

            hitZone.on("pointerdown", (pointer) => {
                const ctx = { sheet: entrySheet, entry: tileData, tileName, groupName: group.name }
                if (pointer && pointer.rightButtonDown && pointer.rightButtonDown()) this.onLabelTile(ctx)
                else this.onPick(fullPath(tileName), ctx)
            })

            this.contentRoot.add([hitZone, idText, nameText])
        })

        this._lastTileCount = tiles.length

        const totalRows = Math.ceil(tiles.length / cols)
        const contentHeight = totalRows * CELL_H
        const visibleHeight = this.cameras.main.height - this._gridTop - 40
        const maxScroll = Math.max(0, contentHeight - visibleHeight)
        this.updateScrollIndicator(maxScroll)
    }
}
