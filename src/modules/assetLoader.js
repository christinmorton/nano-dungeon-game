import SHEETS from "../data/assetSheets.js"

// Shared loader/resolver for the multi-sheet art catalog (src/data/assetSheets.js).
// Lets game scenes preload art packs and lets the render path turn an entity's
// `art: { sheet, file }` (images mode) or `art: { sheet, frame }` (spritesheet
// mode) declaration into a Phaser texture key. Mirrors the key convention the
// TestScreen browser already uses: images load under "<sheetKey>:<file>".

const BY_KEY = Object.fromEntries(SHEETS.map(s => [s.key, s]))

// Sheets the running game renders (entities + item icons). Game scenes preload
// this set so floor sprites and inventory/shop icons resolve. Excludes
// browse-only packs (7souls, lighting, fantasy-dungeon, 32rogues-tiles) that
// aren't wired to entities/items yet.
export const GAME_SHEETS = [
    'heroes', '32rogues-rogues', 'monsters', 'npcs', 'props',
    '32rogues-items', 'minerals', 'traps', 'legendaries', 'cosmic',
    // Per-realm mechanic-prop art selected by ROLE (levels/themeRoles.js). Loaded
    // unconditionally rather than per-theme: a run crosses several realms, and
    // the whole pack is a handful of 32px sprites.
    'realm',
]

// Preload the named sheets into `scene`. `keys` is an allowlist so the game only
// pays to load the packs it actually renders (vs the whole catalog). Idempotent:
// skips anything already in the texture cache.
export function preloadSheets(scene, keys) {
    for (const key of keys) {
        const sheet = BY_KEY[key]
        if (!sheet) { console.warn(`preloadSheets: unknown sheet '${key}'`); continue }
        const meta = sheet.ref._meta || {}
        const mode = meta.mode || "spritesheet"
        if (mode === "images") {
            for (const [group, entries] of Object.entries(sheet.ref)) {
                if (group === "_meta" || !entries || typeof entries !== "object") continue
                for (const entry of Object.values(entries)) {
                    if (!entry || !entry.file) continue
                    const texKey = `${key}:${entry.file}`
                    if (!scene.textures.exists(texKey)) {
                        scene.load.image(texKey, `${meta.dir}/${entry.file}`)
                    }
                }
            }
        } else if (meta.sheet) {
            if (!scene.textures.exists(key)) {
                scene.load.spritesheet(key, meta.sheet, {
                    frameWidth: meta.tileSize || 16,
                    frameHeight: meta.tileSize || 16,
                    spacing: meta.spacing || 0
                })
            }
        }
    }
}

// Resolve an entity's art declaration to { key, frame, isImage, nativeSize }.
// Returns null when no art is declared or the sheet is unknown, so the render
// path can fall back to the legacy Kenney `entity.tile`.
export function resolveArt(art) {
    if (!art || !art.sheet) return null
    const sheet = BY_KEY[art.sheet]
    if (!sheet) return null
    const meta = sheet.ref._meta || {}
    const mode = meta.mode || "spritesheet"
    const nativeSize = meta.tileSize || 16
    if (mode === "images") {
        if (!art.file) return null
        return { key: `${art.sheet}:${art.file}`, frame: undefined, isImage: true, nativeSize }
    }
    // Spritesheet: accept an explicit frame, or a named entry resolved to its
    // frame via the sheet's reference (profiles read better as names than ints).
    let frame = art.frame
    if (frame == null && art.name) frame = frameIndexFor(art.sheet, sheet)[art.name]
    return { key: art.sheet, frame: frame ?? 0, isImage: false, nativeSize }
}

// Create a UI/icon sprite for an entity, preferring its PNG art over the
// legacy Kenney tile (graceful fallback when the art isn't loaded). Scales to
// `display` px; origin defaults to centre. `tintFill` only applies to the
// Kenney monochrome fallback — coloured PNG art uses a plain multiply tint.
export function addEntityIcon(scene, x, y, entity, opts = {}) {
    const { display = 16, originX = 0.5, originY = 0.5, tintFill = false } = opts
    const art = resolveArt(entity?.art)
    let sprite
    if (art && scene.textures.exists(art.key)) {
        sprite = art.isImage
            ? scene.add.sprite(x, y, art.key)
            : scene.add.sprite(x, y, art.key, art.frame)
        sprite.setScale(display / art.nativeSize)
        if (entity.tint) sprite.tint = entity.tint
    } else {
        sprite = scene.add.sprite(x, y, "tiles", entity?.tile ?? 0)
        sprite.setScale(display / 16)
        if (entity?.tint) { sprite.tint = entity.tint; sprite.tintFill = tintFill }
    }
    return sprite.setOrigin(originX, originY)
}

// Lazily build + cache a name->frame index for a spritesheet reference so
// entity art can be declared by name, e.g. { sheet: "32rogues-items", name: "longSword" }.
const FRAME_INDEX = {}
function frameIndexFor(sheetKey, sheet) {
    if (FRAME_INDEX[sheetKey]) return FRAME_INDEX[sheetKey]
    const idx = {}
    for (const [group, entries] of Object.entries(sheet.ref)) {
        if (group === "_meta" || !entries || typeof entries !== "object") continue
        for (const [name, entry] of Object.entries(entries)) {
            if (entry && typeof entry === "object" && typeof entry.frame === "number") {
                idx[name] = entry.frame
            }
        }
    }
    FRAME_INDEX[sheetKey] = idx
    return idx
}
