// validate_tile_labels.mjs — check the tile-label store against the sheets it
// addresses, and report what would otherwise fail silently.
//
// The reason this exists: autotile.js accepts exactly nine direction tokens and
// ignores everything else. A terrain labeled "grass:center" instead of "grass:c"
// simply never appears in the designer's terrain picker, with no error anywhere —
// you find out by noticing an absence. Same class of problem for a stray position
// code saved as a label, a set missing one of its nine slots, or a region whose
// rectangle runs off the edge of its sheet.
//
// Also verifies each sheet's declared grid against its PNG's real dimensions
// (read from the header), because a wrong grid poisons every label made against
// it — the "verify before labeling" gate, enforceable from the command line.
//
// Usage, from code/v3:
//   node scripts/validate_tile_labels.mjs             # all sheets
//   node scripts/validate_tile_labels.mjs forest-autotile snow-autotile
//   node scripts/validate_tile_labels.mjs --grids     # grid check only
//
// Exit code 1 if any ERROR is reported (warnings alone exit 0), so it can gate a
// commit. Read-only: it never writes to the store.

import { readFileSync, readdirSync, existsSync } from "node:fs"
import { inflateSync } from "node:zlib"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "..")
const DATA = join(ROOT, "src", "data")
const PUBLIC = join(ROOT, "public")

// Kept in step with levels/autotile.js. OUTER is what makes a terrain
// selectable (fill + edges + convex corners); INNER is the concave-corner block
// these sheets ship as a 2x2 beside each 3x3 — recorded and validated, but not
// yet consumed (choosing one needs diagonal neighbour info).
const DIRS = ["c", "n", "s", "e", "w", "nw", "ne", "sw", "se"]
const INNER = ["inw", "ine", "isw", "ise"]
const DIR_SET = new Set([...DIRS, ...INNER])
const POSITION_CODE = /^r\d+_c\d+$/

const args = process.argv.slice(2)
const gridsOnly = args.includes("--grids")
const only = new Set(args.filter(a => !a.startsWith("--")))

let errors = 0, warnings = 0
const err = (msg) => { errors++; console.log(`  ERROR   ${msg}`) }
const warn = (msg) => { warnings++; console.log(`  warn    ${msg}`) }
const ok = (msg) => console.log(`  ok      ${msg}`)

// ---- inputs ---------------------------------------------------------------

function readJSON(path, fallback) {
    if (!existsSync(path)) return fallback
    return JSON.parse(readFileSync(path, "utf8"))
}

// PNG dimensions straight from the IHDR chunk — same trick as
// build_resource_imports.mjs, so no image library is needed.
function pngSize(path) {
    if (!existsSync(path)) return null
    const buf = readFileSync(path)
    if (buf.toString("ascii", 1, 4) !== "PNG") return null
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

// ---- alpha, for the hollow-fill check ------------------------------------
//
// A terrain can pass every structural check and still be broken: all nine slots
// labeled, and a ":c" pointing at a FULLY TRANSPARENT frame. That happens
// whenever a 3x3 block is a ring rather than a fill — a fence, a doorway, a wall
// enclosure. It has 8 tiles and a hole, and the hole is not a floor. Painting it
// gives invisible ground, and the terrain sits in the designer's picker as a
// trap. Five blocks on `castletown` alone were this shape.
//
// Structure cannot detect it, so this decodes the actual pixels. Pure node —
// zlib is enough for the non-interlaced 8-bit PNGs every sheet here uses; a PNG
// this can't read degrades to a warning, never a false error.

const alphaCache = new Map()

function loadAlpha(path) {
    if (alphaCache.has(path)) return alphaCache.get(path)
    let out = null
    try { out = decodeAlpha(path) } catch { out = null }
    alphaCache.set(path, out)
    return out
}

function decodeAlpha(path) {
    const buf = readFileSync(path)
    if (buf.toString("ascii", 1, 4) !== "PNG") return null
    let off = 8, w = 0, h = 0, depth = 0, color = 0, interlace = 0, trns = null
    const idat = []
    while (off < buf.length) {
        const len = buf.readUInt32BE(off)
        const type = buf.toString("ascii", off + 4, off + 8)
        const data = buf.subarray(off + 8, off + 8 + len)
        if (type === "IHDR") {
            w = data.readUInt32BE(0); h = data.readUInt32BE(4)
            depth = data[8]; color = data[9]; interlace = data[12]
        } else if (type === "tRNS") trns = Buffer.from(data)
        else if (type === "IDAT") idat.push(Buffer.from(data))
        else if (type === "IEND") break
        off += 12 + len
    }
    // Colour types 0 (grey) and 2 (RGB) carry no alpha at all, so every pixel is
    // opaque and the check is vacuous — skip rather than report everything solid.
    if (interlace || depth !== 8 || color === 0 || color === 2) return null
    const channels = { 3: 1, 4: 2, 6: 4 }[color]
    if (!channels) return null

    const raw = inflateSync(Buffer.concat(idat))
    const stride = w * channels
    const px = Buffer.alloc(h * stride)
    for (let y = 0; y < h; y++) {                       // undo per-scanline filters (PNG spec 9.2)
        const filter = raw[y * (stride + 1)]
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
        for (let x = 0; x < stride; x++) {
            const a = x >= channels ? px[y * stride + x - channels] : 0
            const b = y > 0 ? px[(y - 1) * stride + x] : 0
            const c = (x >= channels && y > 0) ? px[(y - 1) * stride + x - channels] : 0
            let v = line[x]
            if (filter === 1) v += a
            else if (filter === 2) v += b
            else if (filter === 3) v += (a + b) >> 1
            else if (filter === 4) {
                const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
                v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)
            }
            px[y * stride + x] = v & 0xff
        }
    }
    const alpha = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) {
        if (color === 3) { const idx = px[i]; alpha[i] = (trns && idx < trns.length) ? trns[idx] : 255 }
        else if (color === 4) alpha[i] = px[i * 2 + 1]
        else alpha[i] = px[i * 4 + 3]
    }
    return { w, h, alpha }
}

// Fraction of a frame's pixels that are not transparent, or null if unknown.
function frameCoverage(meta, img, frame) {
    if (!img || !meta.columns) return null
    const size = meta.tileSize || 16
    const fw = meta.frameWidth || size, fh = meta.frameHeight || size
    const sp = meta.spacing || 0, mg = meta.margin || 0
    const col = frame % meta.columns, row = Math.floor(frame / meta.columns)
    const x0 = mg + col * (fw + sp), y0 = mg + row * (fh + sp)
    if (x0 < 0 || y0 < 0 || x0 + fw > img.w || y0 + fh > img.h) return null
    let n = 0
    for (let y = y0; y < y0 + fh; y++) {
        for (let x = x0; x < x0 + fw; x++) if (img.alpha[y * img.w + x] > 8) n++
    }
    return n / (fw * fh)
}

// Every tileReference.*.json, keyed by the sheet key the label store uses. That
// key is the assetSheets.js SHEETS key — the _meta.key minus the file prefix —
// except for the legacy Kenney file, whose _meta has no `key` at all.
function loadSheets() {
    const out = {}
    for (const file of readdirSync(DATA)) {
        if (!/^tileReference\..*\.json$/.test(file) && file !== "tileReference.json") continue
        const ref = readJSON(join(DATA, file), null)
        if (!ref || !ref._meta) continue
        const key = file === "tileReference.json"
            ? "kenney"
            : file.replace(/^tileReference\./, "").replace(/\.json$/, "")
        out[key] = ref._meta
    }
    return out
}

const store = readJSON(join(DATA, "tileLabels.json"), { labels: {}, regions: {} })
const sheets = loadSheets()
const labels = store.labels || {}
const regions = store.regions || {}

const wanted = (key) => !only.size || only.has(key)

// ---- grid check -----------------------------------------------------------

function checkGrid(key, meta) {
    if (!meta.sheet) return null                       // images-mode pack; nothing to slice
    const png = pngSize(join(PUBLIC, meta.sheet))
    if (!png) { warn(`${key}: PNG not found or unreadable (${meta.sheet})`); return null }

    const size = meta.tileSize || 16
    const fw = meta.frameWidth || size, fh = meta.frameHeight || size
    const sp = meta.spacing || 0, mg = meta.margin || 0
    const pitchW = fw + sp, pitchH = fh + sp
    const fitCols = Math.floor((png.w - 2 * mg + sp) / pitchW)
    const fitRows = Math.floor((png.h - 2 * mg + sp) / pitchH)
    const exactW = (png.w - 2 * mg + sp) % pitchW === 0
    const exactH = (png.h - 2 * mg + sp) % pitchH === 0

    if (!exactW || !exactH) {
        err(`${key}: grid does not divide the PNG — ${png.w}x${png.h} at ${fw}x${fh}` +
            `${sp ? ` sp${sp}` : ""}${mg ? ` mg${mg}` : ""} fits ${fitCols}x${fitRows} with a remainder. ` +
            `Frame size is wrong; every label on this sheet is suspect.`)
    } else if (meta.columns && (fitCols !== meta.columns || (meta.rows && fitRows !== meta.rows))) {
        err(`${key}: declared ${meta.columns}x${meta.rows} but the PNG fits ${fitCols}x${fitRows}`)
    }
    if (meta.browseAllFrames && meta.total && meta.columns && meta.rows &&
        meta.total !== meta.columns * meta.rows) {
        warn(`${key}: total ${meta.total} != columns*rows (${meta.columns * meta.rows})`)
    }
    if (/VERIFY/i.test(meta.note || "")) {
        warn(`${key}: _meta.note still says VERIFY — grid was inferred, not confirmed in the Atlas`)
    }
    return { cols: fitCols, rows: fitRows, total: meta.total || fitCols * fitRows }
}

// ---- label check ----------------------------------------------------------

function checkLabels(key, meta, grid) {
    const map = labels[key] || {}
    const entries = Object.entries(map)
    if (!entries.length) return

    const terrains = {}
    const total = (meta && meta.total) || (grid && grid.total) || 0
    const img = (meta && meta.sheet) ? loadAlpha(join(PUBLIC, meta.sheet)) : null

    for (const [frameKey, name] of entries) {
        const frame = Number(frameKey)
        const isIndex = Number.isFinite(frame)

        if (isIndex && total && (frame < 0 || frame >= total)) {
            err(`${key} #${frame} "${name}": frame index is outside the sheet (0..${total - 1})`)
        }
        if (POSITION_CODE.test(name)) {
            err(`${key} #${frameKey}: "${name}" is a position code, not a name — the prompt's ` +
                `default was saved unchanged. Clear it or give it a real name.`)
            continue
        }
        const i = name.lastIndexOf(":")
        if (i < 0) continue                             // a plain name; intentional, not terrain
        const terrain = name.slice(0, i), dir = name.slice(i + 1)
        if (!terrain) {
            err(`${key} #${frameKey}: "${name}" has an empty terrain name`)
            continue
        }
        if (!DIR_SET.has(dir)) {
            err(`${key} #${frameKey}: "${name}" — "${dir}" is not a direction token ` +
                `(${DIRS.join(" ")} | ${INNER.join(" ")}). autotile.js drops this frame.`)
            continue
        }
        const set = terrains[terrain] || (terrains[terrain] = {})
        if (set[dir] != null) {
            warn(`${key}: terrain "${terrain}" has two frames for :${dir} (#${set[dir]} and #${frameKey}) — ` +
                 `the later one wins, which is whichever the JSON happens to list last`)
        }
        set[dir] = frameKey
    }

    // A label pointing at a blank frame names nothing. Usually a rect sized one
    // row or column too far, so it's worth surfacing on its own.
    if (img) {
        for (const [frameKey, name] of entries) {
            const frame = Number(frameKey)
            if (!Number.isFinite(frame)) continue
            const cov = frameCoverage(meta, img, frame)
            if (cov != null && cov < 0.02) {
                warn(`${key} #${frame} "${name}": that frame is empty — the label names nothing`)
            }
        }
    }

    for (const [terrain, set] of Object.entries(terrains)) {
        const missing = DIRS.filter(d => set[d] == null)
        const innerHave = INNER.filter(d => set[d] != null).length
        // Inner corners are optional — a terrain is selectable on the outer nine
        // alone. Report the count so a half-labeled 2x2 block is still visible.
        const innerNote = innerHave === 4 ? " + 4 inner corners"
            : innerHave ? ` + ${innerHave}/4 inner corners (incomplete)`
            : ""
        // The hollow-fill check. Only meaningful once the set is otherwise
        // complete — an incomplete terrain is already being reported.
        const fillCov = (!missing.length && set.c != null) ? frameCoverage(meta, img, Number(set.c)) : null
        if (fillCov != null && fillCov < 0.02) {
            err(`${key}: terrain "${terrain}" has a TRANSPARENT fill — its ":c" (#${set.c}) is an empty frame. ` +
                `This block is a ring (a fence, doorway or wall enclosure), not a fill terrain: it has 8 tiles ` +
                `and a hole. Painting it produces invisible ground. Make it a named REGION instead.`)
            continue
        }
        if (!missing.length) ok(`${key}: terrain "${terrain}" is complete (9/9)${innerNote} — selectable in the designer`)
        else warn(`${key}: terrain "${terrain}" is ${9 - missing.length}/9, missing ${missing.join(" ")} — ` +
                  `invisible to the terrain picker until complete`)
    }
}

// ---- region check ---------------------------------------------------------

function checkRegions(key, meta, grid) {
    const list = regions[key] || []
    if (!list.length) return
    const cols = (meta && meta.columns) || (grid && grid.cols) || 0
    const rows = (meta && meta.rows) || (grid && grid.rows) || 0

    const seenNames = new Map()
    // Occupancy map, so overlap is reported against the region actually sitting
    // there rather than by comparing every pair.
    const occupied = new Map()

    for (const r of list) {
        const at = `${r.w}x${r.h} @ c${r.col},r${r.row}`
        if (!r.name || !Number.isInteger(r.col) || !Number.isInteger(r.row) ||
            !Number.isInteger(r.w) || !Number.isInteger(r.h) || r.w < 1 || r.h < 1) {
            err(`${key}: malformed region ${JSON.stringify(r)}`)
            continue
        }
        if (seenNames.has(r.name)) {
            err(`${key}: two regions named "${r.name}" (${seenNames.get(r.name)} and ${at})`)
        } else seenNames.set(r.name, at)

        if (cols && rows && (r.col + r.w > cols || r.row + r.h > rows)) {
            err(`${key}: region "${r.name}" ${at} runs off the sheet (grid is ${cols}x${rows})`)
            continue
        }
        for (let y = r.row; y < r.row + r.h; y++) {
            for (let x = r.col; x < r.col + r.w; x++) {
                const cell = `${x},${y}`
                const prev = occupied.get(cell)
                if (prev && prev !== r.name) {
                    warn(`${key}: regions "${prev}" and "${r.name}" overlap at c${x},r${y}`)
                    continue
                }
                occupied.set(cell, r.name)
            }
        }
    }
    ok(`${key}: ${list.length} region${list.length === 1 ? "" : "s"} named`)
}

// ---- run ------------------------------------------------------------------

console.log(`tile-label store: format ${store.format || "?"} version ${store.version || "?"}`)
console.log(`${Object.keys(labels).length} sheet(s) with labels, ${Object.keys(regions).length} with regions, ` +
            `${Object.keys(sheets).length} sheets registered\n`)

// Sheets that carry data but aren't registered — a rename or a deleted sheet
// leaves labels stranded, addressing nothing.
for (const key of new Set([...Object.keys(labels), ...Object.keys(regions)])) {
    if (!sheets[key] && wanted(key)) {
        console.log(key)
        err(`${key}: has labels/regions but no tileReference.${key}.json — stranded data`)
        console.log("")
    }
}

for (const [key, meta] of Object.entries(sheets)) {
    if (!wanted(key)) continue
    const hasData = labels[key] || regions[key]
    // Unlabeled sheets are only interesting for their grid; listing all ~70 of
    // them with "no labels" would bury the real findings.
    if (!hasData && !gridsOnly && !only.size) {
        const grid = meta.sheet ? checkGridQuiet(key, meta) : null
        if (grid && grid.problem) { console.log(key); checkGrid(key, meta); console.log("") }
        continue
    }
    console.log(key)
    const grid = checkGrid(key, meta)
    if (!gridsOnly) {
        checkLabels(key, meta, grid)
        checkRegions(key, meta, grid)
    }
    console.log("")
}

// Grid check with no output — used to decide whether an unlabeled sheet is worth
// printing at all.
function checkGridQuiet(key, meta) {
    const png = pngSize(join(PUBLIC, meta.sheet))
    if (!png) return { problem: true }
    const size = meta.tileSize || 16
    const fw = meta.frameWidth || size, fh = meta.frameHeight || size
    const sp = meta.spacing || 0, mg = meta.margin || 0
    const exactW = (png.w - 2 * mg + sp) % (fw + sp) === 0
    const exactH = (png.h - 2 * mg + sp) % (fh + sp) === 0
    const fitCols = Math.floor((png.w - 2 * mg + sp) / (fw + sp))
    const fitRows = Math.floor((png.h - 2 * mg + sp) / (fh + sp))
    const misdeclared = meta.columns && (fitCols !== meta.columns || (meta.rows && fitRows !== meta.rows))
    return { problem: !exactW || !exactH || misdeclared }
}

console.log(`${errors} error(s), ${warnings} warning(s)`)
process.exit(errors ? 1 : 0)
