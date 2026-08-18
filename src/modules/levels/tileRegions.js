// tileRegions.js — read side of the named-region half of the tile-label store
// (data/tileLabels.json `regions`, authored in the designer's sheet view).
//
// A region names a RECTANGLE of frames as one thing: "cottage-red is 3x4 frames
// starting at col 4, row 12 of the castletown sheet." It exists because the
// per-frame label unit is smaller than the asset — buildings, trees, furniture
// and rock formations span 2x2 to 4x6 frames, and naming each of their frames
// separately loses the one fact that matters, which is that they're one object.
//
// The same lesson as autotile.js applies: this is a CONSUMED format, not
// documentation. Regions resolve to concrete frame indices here, so a caller
// asks for "cottage-red" and gets frames it can paint — never a magic integer
// (the state levels/recipes.js is still in with floorTile: 682).
//
// Stored in FRAME units (col/row/w/h), so a region survives any correct grid and
// never depends on pixel maths. Frame indices stay authoritative: a region is an
// overlay on the grid, never a re-grid of it.

import { tileLabelStore } from "./tileLabelStore.js"
import SHEETS from "../../data/assetSheets.js"

const metaFor = (sheetKey) => {
    const sheet = SHEETS.find(s => s.key === sheetKey)
    return (sheet && sheet.ref && sheet.ref._meta) || null
}

// Every named region on a sheet, as stored.
export function regionsFor(sheetKey) {
    const store = tileLabelStore()
    const all = (store && store.regions) || {}
    const list = all[sheetKey]
    return Array.isArray(list) ? list : []
}

// One region by name, or null.
export function findRegion(sheetKey, name) {
    return regionsFor(sheetKey).find(r => r.name === name) || null
}

// The region's frames as a row-major 2D array: frames[row][col], each a frame
// index paintable on that sheet. `columns` defaults to the sheet's declared grid,
// which is what turns (col,row) into an index at all.
export function regionFrames(sheetKey, region, columns) {
    if (!region) return []
    const meta = metaFor(sheetKey)
    const cols = columns || (meta && meta.columns)
    if (!cols) return []
    const out = []
    for (let r = 0; r < region.h; r++) {
        const row = []
        for (let c = 0; c < region.w; c++) row.push((region.row + r) * cols + (region.col + c))
        out.push(row)
    }
    return out
}

// Flat frame list, for callers that just need "which frames belong to this thing"
// (an asset audit, a validator, a preview thumbnail).
export function regionFrameList(sheetKey, region, columns) {
    return regionFrames(sheetKey, region, columns).flat()
}

// Sorted names of every region on a sheet — the picker-facing list, mirroring
// autotileReadyTerrains() for the terrain half.
export function regionNames(sheetKey) {
    return regionsFor(sheetKey).map(r => r.name).sort()
}
