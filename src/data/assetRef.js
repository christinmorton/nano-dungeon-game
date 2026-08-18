// assetRef.js — the canonical "asset reference": a serializable pointer to an
// approved Atlas asset (a frame in a spritesheet, or an image-mode file), plus
// enough to re-render and identify it. This is the ONE definition of "an asset
// the designer can use anywhere" (the asset-reference primitive): the Atlas
// collection shelf, the general "pick asset" flow, and every future consumer
// (props, items, goal, theme) all speak this shape.
//
//   { path, sheet, group, name, entry:{ tile, frame, file, externalAsset, frameIndex } }
//     path   — unique catalog path (stable id; the collection dedup key)
//     sheet  — loaded texture / sheet KEY (see data/assetSheets.js)
//     group  — the catalog group it came from (display only)
//     name   — human label
//     entry  — the raw catalog fields needed to resolve a sprite / entity.art
//
// Pure + import-safe (no Phaser, no registry) so scenes AND the game runtime can
// share it without dragging the browser in.

// Build a reference from an AssetBrowser pick — the (path, ctx) an onPick gets.
// This is the single source of the collection-item shape (AtlasScene._addToCollection
// builds the same record through here so the two can't drift).
export function assetRefFromContext(path, ctx) {
    const e = ctx.entry || {}
    return {
        path,
        sheet: ctx.sheet.key,
        group: ctx.groupName,
        name: ctx.tileName,
        entry: {
            tile: e.tile, frame: e.frame, file: e.file,
            externalAsset: e.externalAsset, frameIndex: e.frameIndex,
        },
    }
}

// Convert a reference to the entity.art shape the game render path consumes
// (assetLoader.resolveArt): { sheet, file } for image-mode packs, else
// { sheet, frame }. Returns null when the ref can't resolve to renderable art.
export function assetRefToArt(ref) {
    if (!ref || !ref.sheet) return null
    const e = ref.entry || {}
    if (e.file != null) return { sheet: ref.sheet, file: e.file }
    const frame = e.tile ?? e.frame
    if (frame == null) return null
    return { sheet: ref.sheet, frame }
}

// Short one-line label for inspectors / logs, e.g. "Rusty Belt · 32rogues-items #12".
export function describeAssetRef(ref) {
    if (!ref || !ref.sheet) return "none"
    const e = ref.entry || {}
    const which = e.file != null ? e.file : `#${e.tile ?? e.frame ?? "?"}`
    return `${ref.name || "asset"} · ${ref.sheet} ${which}`
}
