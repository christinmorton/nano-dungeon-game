// tileLabelsClient.js — the designer's browser-side access to the tile-label
// store (data/tileLabels.json). Labels name useful frames on a sheet ("grass",
// "wall", "path") so palette authoring isn't a hunt through position codes
// (r0_c5). Both calls talk to the dev-only Vite endpoint (see vite.config.js),
// same browser-front/Node-back design as the item archive.
//
// Shape on disk (version 2):
//   { format, version, labels:  { "<sheetKey>": { "<frame>": "name" } },
//                      regions: { "<sheetKey>": [ { name, col, row, w, h } ] } }
//
// TWO UNITS, because a sheet carries two kinds of thing:
//   - labels  — one name per FRAME. Correct for terrain: a grass tile really is
//     one frame. Key is the spritesheet frame index (as a string); for
//     images-mode sheets it's the entry's file path.
//   - regions — one name per RECTANGLE of frames, in FRAME units (col/row/w/h,
//     not pixels) so a region survives any correct grid and resolves to a frame
//     list on demand. Correct for objects: a cottage is 3x4 frames, and naming
//     each of its 12 frames separately loses the fact that they are one thing.
//
// Frame indices stay authoritative (the guarantee cad8393 made and autotile
// depends on) — a region is an overlay ON the grid, never a re-grid of it.
//
// A version-1 file (no `regions` key) loads unchanged as regions = {}. Saving
// always writes version 2.
//
// Dev-only. If the endpoint isn't there (a built page, or Vite not restarted
// after adding the config), load returns empty and save warns + returns false
// rather than throwing.

const ENDPOINT = "/__designer/tile-labels"
const VERSION = 2

function normalizeLabels(labels) {
    const out = {}
    if (!labels || typeof labels !== "object") return out
    for (const [sheet, frames] of Object.entries(labels)) {
        if (!frames || typeof frames !== "object") continue
        const m = {}
        for (const [frame, name] of Object.entries(frames)) {
            if (typeof name === "string" && name.trim()) m[String(frame)] = name.trim()
        }
        if (Object.keys(m).length) out[sheet] = m
    }
    return out
}

// A region is kept only if it has a name and a positive integer rect. Anything
// malformed is dropped rather than written back, so a hand-edit can't poison the
// store — same defensive posture as normalizeLabels.
function normalizeRegions(regions) {
    const out = {}
    if (!regions || typeof regions !== "object") return out
    for (const [sheet, list] of Object.entries(regions)) {
        if (!Array.isArray(list)) continue
        const keep = []
        for (const r of list) {
            if (!r || typeof r !== "object") continue
            const name = typeof r.name === "string" ? r.name.trim() : ""
            const col = Number(r.col), row = Number(r.row), w = Number(r.w), h = Number(r.h)
            if (!name) continue
            if (![col, row, w, h].every(Number.isInteger)) continue
            if (col < 0 || row < 0 || w < 1 || h < 1) continue
            keep.push({ name, col, row, w, h })
        }
        if (keep.length) out[sheet] = keep
    }
    return out
}

export async function loadTileLabels() {
    try {
        const res = await fetch(ENDPOINT, { cache: "no-store" })
        if (!res.ok) return { labels: {}, regions: {} }
        const raw = await res.json()
        return {
            labels: normalizeLabels(raw && raw.labels),
            regions: normalizeRegions(raw && raw.regions),
        }
    } catch (e) {
        console.warn("[tileLabels] load failed (dev endpoint unavailable? restart Vite)", e)
        return { labels: {}, regions: {} }
    }
}

export async function saveTileLabels(labels, regions) {
    const body = JSON.stringify({
        format: "tile-labels",
        version: VERSION,
        labels: normalizeLabels(labels),
        regions: normalizeRegions(regions),
    }, null, 2)
    try {
        const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        })
        return res.ok
    } catch (e) {
        console.warn("[tileLabels] save failed (dev write endpoint unavailable? restart Vite)", e)
        return false
    }
}
