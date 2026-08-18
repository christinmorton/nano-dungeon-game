// Copies selected resources/ assets into public/ and writes their tileReference sheets:
//   - fantasyrpgtilesetpack generic dungeon tileset (16px) + animated tiles
//   - FREE Textures Of Light + Alpha (64x64) for the lighting layer
// Run from code/v3:  node scripts/build_resource_imports.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from "node:fs"

const RES = "../../resources"
const PUB = "public"
const OUT = "src/data"

function ensure(dir) { mkdirSync(dir, { recursive: true }) }
function pngSize(path) { const b = readFileSync(path); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } }

// ---------- 1. fantasy dungeon tileset + animated ----------
const FANTASY = `${RES}/fantasyrpgtilesetpack_windows/fantasyrpgtilesetpack/Assets/TILESETS`
ensure(`${PUB}/tilesets/fantasyrpg/animated`)
copyFileSync(`${FANTASY}/dungeon.png`, `${PUB}/tilesets/fantasyrpg/dungeon.png`)
for (const f of ["doors.png", "torch.png", "fireplace.png", "puzzle.png"]) {
    copyFileSync(`${FANTASY}/animated/${f}`, `${PUB}/tilesets/fantasyrpg/animated/${f}`)
}
const dSize = pngSize(`${PUB}/tilesets/fantasyrpg/dungeon.png`)
const cols = Math.floor(dSize.w / 16), rows = Math.floor(dSize.h / 16)
writeFileSync(`${OUT}/tileReference.fantasyrpg-dungeon.json`, JSON.stringify({
    _meta: {
        pack: "Fantasy RPG Tileset Pack (Time Fantasy style)",
        key: "tileReference.fantasyrpg-dungeon",
        mode: "spritesheet",
        browseAllFrames: true,
        sheet: "tilesets/fantasyrpg/dungeon.png",
        tileSize: 16,
        spacing: 0,
        columns: cols,
        rows,
        total: cols * rows,
        view: "top-down dungeon tileset",
        license: "Commercial pixel pack (purchased). Direct in-game use OK; NO AI input. (Time Fantasy style.)",
        note: `Generic (non-RPG-Maker) dungeon tileset: floors, wall auto-tiles, ceilings, doors, ladders, crates, columns, chests, fountains. 16px grid (${cols}x${rows}). Full grid browsable by frame index; pick tiles by position. Caveat: RPG-Maker-style palette is brighter than the muted 32rogues/PixelLab world — evaluate fit when testing.`,
        referenceDoc: "documents/v3_item_prop_art_coverage_audit.md"
    }
}, null, 2) + "\n")

// ---------- 2. light textures (64x64) + alpha ----------
function findDir(base, name) {
    for (const e of readdirSync(base, { withFileTypes: true })) {
        const p = `${base}/${e.name}`
        if (e.isDirectory()) {
            if (e.name === name) return p
            const found = findDir(p, name)
            if (found) return found
        }
    }
    return null
}
function copyLight(srcBase, destSub, prefix) {
    const dir = findDir(`${RES}/${srcBase}`, "64x64")
    ensure(`${PUB}/${destSub}`)
    const entries = {}
    for (const f of readdirSync(dir)) {
        if (!/\.png$/i.test(f)) continue
        const m = f.match(/\((\d+)\)/)
        if (!m) continue
        const n = m[1]
        const out = `${prefix}_${n}.png`
        copyFileSync(`${dir}/${f}`, `${PUB}/${destSub}/${out}`)
        entries[`${prefix}${n}`] = { file: out, audit: true, note: `FREE Textures Of Light 64x64 #${n}` }
    }
    return entries
}
const light = copyLight("FREE Textures Of Light", "lighting/light", "light")
const lightAlpha = copyLight("FREE Textures Of Light Alpha", "lighting/light_alpha", "lightAlpha")

const lightMetaNote = "64x64 light/glow overlays for the lighting layer (torch glow, the darkness mechanic, magic glows) — NOT environment tiles. Use additively (BLEND). Names are placeholders pending a curation pass."
writeFileSync(`${OUT}/tileReference.lighting-light.json`, JSON.stringify({
    _meta: { pack: "FREE Textures Of Light", key: "tileReference.lighting-light", mode: "images", dir: "lighting/light", tileSize: 64, view: "lighting overlay (additive)", license: "Free/purchased texture pack; direct use OK; NO AI input.", note: lightMetaNote, referenceDoc: "documents/v3_item_prop_art_coverage_audit.md" },
    light
}, null, 2) + "\n")
writeFileSync(`${OUT}/tileReference.lighting-light-alpha.json`, JSON.stringify({
    _meta: { pack: "FREE Textures Of Light Alpha", key: "tileReference.lighting-light-alpha", mode: "images", dir: "lighting/light_alpha", tileSize: 64, view: "lighting alpha mask", license: "Free/purchased texture pack; direct use OK; NO AI input.", note: "Alpha-mask variants of the light textures (for masking/erosion lighting). " + lightMetaNote, referenceDoc: "documents/v3_item_prop_art_coverage_audit.md" },
    lightAlpha
}, null, 2) + "\n")

console.log(`fantasyrpg-dungeon: ${cols}x${rows} = ${cols * rows} frames`)
console.log(`lighting-light: ${Object.keys(light).length} textures`)
console.log(`lighting-light-alpha: ${Object.keys(lightAlpha).length} textures`)
