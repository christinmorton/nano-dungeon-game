// autotile.js — neighbor-aware terrain tiling driven by the tile-label store
// (data/tileLabels.json, authored in the designer Atlas). A terrain is labeled
// as a 3x3 block: "<terrain>:c" (fill, fully surrounded) + the four edges
// "<terrain>:n|s|e|w" + the four outer corners "<terrain>:nw|ne|sw|se". Given a
// floor cell and which of its 4 cardinal neighbors are the SAME terrain, the
// engine picks the frame that reads as the correct edge/corner/fill.
//
// That 9-tile set renders rooms cleanly (fill + straight edges + convex corners)
// but cannot express a CONCAVE corner, so terrains also carry a 2x2 inner block
// ("<terrain>:inw|ine|isw|ise") that pickAutotileFrame consults once all four
// cardinals match. A terrain labeled with only the outer nine still works — the
// inner keys fall back to the fill, which is what it drew before.
//
// 1-WIDE STRIPS REMAIN UNEXPRESSIBLE. Both sides run out at once, so a horizontal
// strip picks "n" for its whole length. That is a limit of the art, not of the
// picker: no 13-tile set has a tile for it.

import { tileLabelStore, onTileLabelsChanged } from "./tileLabelStore.js"

// The OUTER set: fill + 4 edges + 4 convex corners. These nine are what
// pickAutotileFrame chooses between, and what makes a terrain selectable.
export const OUTER_DIRS = ["c", "n", "s", "e", "w", "nw", "ne", "sw", "se"]

// The INNER set: concave corners, where the terrain wraps AROUND a pocket of
// something else. These sheets ship them as a 2x2 block beside each 3x3 — one
// tile per corner the pocket can sit in. They were previously being labeled as
// "<terrain>-bush:nw" etc., which read as a separate terrain stuck at 4/9 and
// never appeared anywhere.
//
// CONSUMED by pickAutotileFrame, which takes a neighbour predicate and so can ask
// about diagonals. 32 of the 39 complete terrains carry all four; the rest (the
// castletown brick walls, red-carpet, dark-pool, leafy-grass-water) fall back to
// fill and render as they always have.
export const INNER_DIRS = ["inw", "ine", "isw", "ise"]

const DIR_SET = new Set([...OUTER_DIRS, ...INNER_DIRS])

// Parse the label map for a sheet into { terrain: { c,n,s,e,w,nw,ne,sw,se } } of
// frame indices. Only "<terrain>:<dir>" labels contribute; plain labels (fill
// variants like "leafy-grass-1", item names, leftover position codes) are ignored.
export function autotileTerrains(sheetKey) {
    const store = tileLabelStore()
    const raw = (store && store.labels && store.labels[sheetKey]) || {}
    const terrains = {}
    for (const [frameStr, labelRaw] of Object.entries(raw)) {
        const frame = Number(frameStr)
        if (!Number.isFinite(frame)) continue
        const label = String(labelRaw).trim()
        const i = label.lastIndexOf(":")
        if (i < 0) continue
        const terrain = label.slice(0, i)
        const dir = label.slice(i + 1)
        // A label that LOOKS like a terrain tile ("grass:center") but uses a token
        // outside DIR_SET used to vanish here in silence, costing a whole terrain
        // with no error anywhere. It's still not honoured — the token set is the
        // contract — but it no longer disappears quietly. Plain labels (no colon)
        // are intentional and never warn; they're filtered by the `i < 0` check.
        if (!terrain || !DIR_SET.has(dir)) {
            warnOnce(`[autotile] ${sheetKey} #${frame} "${label}" — "${dir}" is not a direction token ` +
                     `(use one of ${[...DIR_SET].join(" ")}); this frame is ignored`)
            continue
        }
        ;(terrains[terrain] || (terrains[terrain] = {}))[dir] = frame
    }
    return terrains
}

// autotileTerrains runs on every terrain-picker repaint, so warn once per message
// rather than once per call. Cleared when the store changes, so fixing a bad
// label in the Atlas and then re-breaking it warns again instead of staying quiet.
const warned = new Set()
function warnOnce(msg) {
    if (warned.has(msg)) return
    warned.add(msg)
    console.warn(msg)
}
onTileLabelsChanged(() => warned.clear())

// The terrains on a sheet that are complete enough to autotile: they must carry a
// fill (c) plus all four edges + four corners. Returned as a sorted name list for
// the designer's terrain picker.
export function autotileReadyTerrains(sheetKey) {
    const terrains = autotileTerrains(sheetKey)
    return Object.keys(terrains)
        .filter(name => OUTER_DIRS.every(d => terrains[name][d] != null))
        .sort()
}

// A terrain's FILL frame (its ":c", fully-surrounded tile), or null if the
// terrain isn't labeled on this sheet. This is the single frame that best
// represents a terrain, so it serves as its thumbnail, and — more importantly —
// as the flat fallback frame a theme carries alongside the terrain name (see
// dungeonTypes.themeForDungeonType, which needs it to satisfy MapState's
// validAuthoredTheme check).
export function terrainFillFrame(sheetKey, terrain) {
    if (!terrain) return null
    const set = autotileTerrains(sheetKey)[terrain]
    return (set && set.c != null) ? set.c : null
}

// Frames carrying one of the given PLAIN labels — the labels autotileTerrains
// deliberately skips, because they have no ":dir" suffix. Those are the sheets'
// seamless fill variants ("sand-1", "snow-2", "leafy-grass-1"): borderless tiles
// meant to carpet an area, as opposed to a terrain, which is a bordered patch
// stamped ON such a carpet.
//
// Returned in the order the names were asked for, skipping any that aren't
// labeled, so a caller can name a preferred fill first and let the rest be
// variety. Names, not frame numbers, so this stays on the right side of the
// "never hard-code a frame" rule.
export function framesForLabels(sheetKey, names) {
    const store = tileLabelStore()
    const raw = (store && store.labels && store.labels[sheetKey]) || {}
    const byLabel = new Map()
    for (const [frameStr, labelRaw] of Object.entries(raw)) {
        const label = String(labelRaw).trim()
        if (label.includes(":")) continue          // a terrain tile, not a plain fill
        if (!byLabel.has(label)) byLabel.set(label, Number(frameStr))
    }
    return names.map(n => byLabel.get(n)).filter(f => Number.isFinite(f))
}

// Pick the frame for a cell. `same(dx, dy)` answers whether the neighbour at that
// offset is the SAME terrain (true) or runs out (false); the caller owns the grid,
// so this stays coordinate-free. A predicate rather than a row of booleans because
// the chain needs diagonals as well as cardinals, and eight positional flags is a
// transposition waiting to happen.
//
// Two adjacent sides out → a convex corner; one side out → an edge; none out →
// interior, which is either a CONCAVE corner or plain fill. Falls back to the fill
// (c) when a specific tile is missing, so a terrain labeled with only the outer
// nine renders exactly as it did before inner corners existed.
export function pickAutotileFrame(set, same) {
    if (!set) return null
    const n = same(0, -1), e = same(1, 0), s = same(0, 1), w = same(-1, 0)
    let key
    if (!n && !w) key = "nw"
    else if (!n && !e) key = "ne"
    else if (!s && !w) key = "sw"
    else if (!s && !e) key = "se"
    else if (!n) key = "n"
    else if (!s) key = "s"
    else if (!w) key = "w"
    else if (!e) key = "e"
    // All four cardinals match, so the cell is interior — but it is a CONCAVE
    // corner if a DIAGONAL runs out, and the outer nine cannot express that. Left
    // as fill, the terrain's border ring stops dead at every corridor mouth and
    // L-shaped elbow, which is what "the wrong tile is drawn" looked like.
    //
    // These four are only reachable once every cardinal matches — exactly the case
    // that returned "c" before — so consuming them cannot change a tile the outer
    // chain already got right. A cell concave on more than one diagonal can only
    // draw one tile; the order here mirrors the convex chain above so the choice
    // is deterministic.
    else if (!same(-1, -1)) key = "inw"
    else if (!same(1, -1)) key = "ine"
    else if (!same(-1, 1)) key = "isw"
    else if (!same(1, 1)) key = "ise"
    else key = "c"
    return set[key] != null ? set[key] : (set.c != null ? set.c : null)
}

// ---------------------------------------------------------------------------
// WALL PATCH SETS — a second autotile scheme, for sheets that ship one.
//
// The 3x3 terrain block above is a BORDERED PATCH: nine tiles, chosen by which
// cardinals match. It has two limits that show badly on a large wall mass —
// every cell of the interior is the same pixels (so the mass reads as a lattice),
// and every wall is drawn from directly overhead.
//
// The original `game_dev_sprites` wall sheets solve both by indexing on more than
// the mask. Each of the 16 neighbour masks carries a `block x block` patch of
// CUTS, and which cut a cell draws is decided by its position on the map — so
// neighbouring cells of one flat mass draw different pixels and the surface reads
// as rock rather than tiling. On top of that the sheet ships a separate row of
// FACE frames: where the cell below is open floor you are looking at the front of
// the wall, not the top of it, and the art switches to elevation.
//
// The scheme is declared by the SHEET (`_meta.block` / `capRange` / `faceRange`,
// written by scripts/build_sprite_reference.mjs from the pack's own manifest),
// not by the theme. That is deliberate: there is exactly one right way to paint a
// given sheet, so detecting it from the art removes a theme field that would have
// to be threaded through the producer, normalizeTheme AND the designer round-trip
// — the field-dropped-in-one-of-three-places bug, avoided by not adding a field.
//
// NOT EVERY CAP IS REACHABLE, and that is not a defect. With faces in use, a cell
// only draws a cap when the cell below is wall, so the S bit is always set and the
// eight masks without it go unused. The sheet carries all sixteen so the same art
// also supports a pure top-down look with no faces at all.

// Read a sheet's patch declaration off its `_meta`, or null if it doesn't have
// one. Pure — takes the meta rather than reaching for the sheet registry — so
// this module stays free of import-order concerns.
export function wallPatchSpec(meta) {
    if (!meta) return null
    const { block, capRange, faceRange } = meta
    if (!Number.isFinite(block) || block < 1) return null
    if (!Array.isArray(capRange) || capRange.length !== 2) return null
    if (!Array.isArray(faceRange) || faceRange.length !== 2) return null
    return { block, capRange, faceRange }
}

// The representative single frame for a patch wall — the fully-enclosed cap
// (mask 15, first cut), i.e. what a cell deep inside a wall mass draws. Themes
// carry one flat wall frame alongside the scheme, both as the fallback and to
// satisfy MapState's validAuthoredTheme check, which requires real FRAMES.
export function wallPatchFillFrame(spec) {
    if (!spec) return null
    return spec.capRange[0] + 15 * spec.block * spec.block
}

// Pick the frame for a wall cell at map position (x, y). `isWall(x, y)` answers
// whether a cell is part of the same wall mass; the caller owns the grid, and is
// expected to treat OUT OF BOUNDS AS WALL so the map border reads as solid rather
// than being framed by an edge (same rule the terrain path uses).
export function pickWallPatchFrame(spec, x, y, isWall) {
    if (!spec) return null
    const { block, capRange, faceRange } = spec
    // Positive modulo: grid coords are never negative today, but a cut chosen by
    // position must not flip if that ever changes.
    const cut = n => ((n % block) + block) % block

    // The cell below is open, so this is the SOUTH FACE of the mass — the wall
    // seen from the front. Only the horizontal neighbours matter, because a face
    // runs left/right along the edge and has no top or bottom to match.
    if (!isWall(x, y + 1)) {
        const m = (isWall(x - 1, y) ? 1 : 0) + (isWall(x + 1, y) ? 2 : 0)
        const frame = faceRange[0] + m * block + cut(x)
        return frame >= faceRange[0] && frame <= faceRange[1] ? frame : null
    }

    const mask = (isWall(x, y - 1) ? 1 : 0) + (isWall(x + 1, y) ? 2 : 0)
               + (isWall(x, y + 1) ? 4 : 0) + (isWall(x - 1, y) ? 8 : 0)
    const frame = capRange[0] + mask * block * block + cut(y) * block + cut(x)
    return frame >= capRange[0] && frame <= capRange[1] ? frame : null
}
