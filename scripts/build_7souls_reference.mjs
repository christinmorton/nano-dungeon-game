// Decodes the 7Souls sheets (zero-dep PNG reader via zlib) and writes a reference file that
// enumerates ONLY the non-empty 16x16 icon cells — fixing the grid pitch and dropping the
// trailing empty cells. Icons are unidentified, so names are placeholders flagged `audit:true`
// (orange in TestScreen) for a later naming pass.
// Run from code/v3:  node scripts/build_7souls_reference.mjs
import { readFileSync, writeFileSync } from "node:fs"
import zlib from "node:zlib"

const TILE = 16

function decodePNG(path) {
    const buf = readFileSync(path)
    let p = 8, width = 0, height = 0, colorType = 0, bitDepth = 8
    const idat = []
    while (p < buf.length) {
        const len = buf.readUInt32BE(p)
        const type = buf.toString("ascii", p + 4, p + 8)
        const data = buf.subarray(p + 8, p + 8 + len)
        if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9] }
        else if (type === "IDAT") idat.push(data)
        else if (type === "IEND") break
        p += 12 + len
    }
    if (bitDepth !== 8) throw new Error("only 8-bit PNGs supported, got " + bitDepth)
    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : colorType === 4 ? 2 : 0
    const bpp = channels
    const stride = width * bpp
    const raw = zlib.inflateSync(Buffer.concat(idat))
    const out = Buffer.alloc(height * stride)
    let pos = 0
    for (let y = 0; y < height; y++) {
        const filter = raw[pos++]
        for (let x = 0; x < stride; x++) {
            const rb = raw[pos++]
            const a = x >= bpp ? out[y * stride + x - bpp] : 0
            const b = y > 0 ? out[(y - 1) * stride + x] : 0
            const c = (x >= bpp && y > 0) ? out[(y - 1) * stride + x - bpp] : 0
            let val
            switch (filter) {
                case 0: val = rb; break
                case 1: val = rb + a; break
                case 2: val = rb + b; break
                case 3: val = rb + ((a + b) >> 1); break
                case 4: {
                    const pp = a + b - c
                    const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c)
                    val = rb + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
                    break
                }
                default: val = rb
            }
            out[y * stride + x] = val & 0xff
        }
    }
    return { width, height, bpp, stride, data: out, hasAlpha: channels === 4 || channels === 2 }
}

function nonEmptyCells(img) {
    const cols = Math.floor(img.width / TILE)
    const rows = Math.floor(img.height / TILE)
    const cells = []
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let filled = false
            for (let y = r * TILE; y < (r + 1) * TILE && !filled; y++) {
                for (let x = c * TILE; x < (c + 1) * TILE; x++) {
                    const i = y * img.stride + x * img.bpp
                    const alpha = img.hasAlpha ? img.data[i + img.bpp - 1] : 255
                    // treat near-transparent and near-white-bg as empty
                    if (alpha > 16) { filled = true; break }
                }
            }
            if (filled) cells.push({ r, c, frame: r * cols + c })
        }
    }
    return { cols, rows, cells }
}

function build(key, sheet, label) {
    const img = decodePNG(`public/${sheet}`)
    const { cols, rows, cells } = nonEmptyCells(img)
    const tiles = {}
    for (const { r, c, frame } of cells) {
        tiles[`icon_r${r}_c${c}`] = { frame, col: c, row: r, audit: true, note: `7Souls ${label} cell r${r} c${c} — identity TBD` }
    }
    const obj = {
        _meta: {
            pack: "7souls RPG Graphics",
            key,
            mode: "spritesheet",
            sheet,
            tileSize: TILE,
            spacing: 0,
            columns: cols,
            rows,
            total: cols * rows,
            nonEmpty: cells.length,
            view: "UI / inventory icon",
            license: "CC BY-ND 4.0 — credit '7Soul' required; use UNMODIFIED only; NO AI input, NO hand-edits (ND bars derivatives).",
            note: `7Souls ${label}: ${img.width}x${img.height}, ${TILE}px icons in a ${cols}x${rows} grid. Only the ${cells.length} non-empty cells are listed (empties trimmed). Names are placeholders (audit:true) pending an identification pass.`,
            referenceDoc: "documents/v3_item_prop_art_coverage_audit.md"
        },
        icons: tiles
    }
    writeFileSync(`src/data/${key}.json`, JSON.stringify(obj, null, 2) + "\n")
    console.log(`${key}.json: ${img.width}x${img.height}, grid ${cols}x${rows}, ${cells.length} non-empty icons`)
}

build("tileReference.7souls-1a", "7soulsrpggraphics_iconpack/pack_1A/_sheet.png", "pack_1A")
// pack_1B removed 2026-06-07: it was the outline-less duplicate of pack_1A (same 1779-icon set);
// 1A's outlined version reads better at game scale and matches the project's outline style.
