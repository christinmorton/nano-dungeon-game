// Region-backed art, shared by every entity that can be drawn from a NAMED TILE
// REGION rather than a single frame.
//
// Extracted from Prop, which solved this first. It is needed in more places now
// that dungeon themes select art by ROLE (levels/themeRoles.js): a themed chest,
// shrine or font is a region on a tileset, and most of that library is bigger
// than one tile.
//
// WHY A REGION CANNOT JUST BE `{ sheet, name }` ON entity.art:
// resolveArt() resolves `name` through the tileReference's NAMED ENTRIES, which
// is a different store from the label store that holds regions — the terrain
// sheets have zero named entries. So a region name silently missed, fell through
// to `frame ?? 0`, and every region-named role rendered TILE 0 of its sheet.
// Regions must be resolved HERE, against the label store, before the art is
// handed to the render path.
//
// NO MapState IMPORT, deliberately — same reason Prop has none:
// MapState -> BSPLevel -> spawnFromTable -> components/decor.js -> Prop would
// close an import cycle, and this module sits in the same neighbourhood.
// Everything the renderer needs is already on the anchor sprite: its world
// position and its display size, which IS one tile.

import { findRegion, regionFrames } from "../levels/tileRegions.js"
import { resolveArt, frameForName } from "../assetLoader.js"

// { sheet, name } -> { sheet, frames[][], w, h }, or null when the name resolves
// nowhere. Callers fall back to their own single tile on null.
//
// TWO STORES HOLD NAMES, and a name is looked up in both. Sheets that were
// hand-labeled in the Atlas keep their objects as REGIONS (rectangles of frames)
// in the label store — that is the multi-tile case this module exists for. Sheets
// that arrive with their own manifest (the original game_dev_sprites pack) are
// registered as tileReference NAMED ENTRIES instead, one frame per name, and have
// no regions at all.
//
// Checking only the label store is what made every role on such a sheet resolve
// to nothing; checking only named entries would lose every multi-tile object. The
// region store wins when both have the name, because it can express more.
export function resolveRegion(region, who = "regionArt") {
    if (!region || !region.sheet || !region.name) return null
    const found = findRegion(region.sheet, region.name)
    if (found) {
        const frames = regionFrames(region.sheet, found)
        if (!frames.length || !frames[0].length) return null
        return { sheet: region.sheet, frames, w: found.w, h: found.h }
    }
    // A single-frame object addressed by name — a 1x1 "region", so every consumer
    // downstream (footprint, extra sprites, FloorMemory) treats it uniformly.
    const frame = frameForName(region.sheet, region.name)
    if (frame != null) return { sheet: region.sheet, frames: [[frame]], w: 1, h: 1 }
    console.warn(`[${who}] '${region.name}' is neither a region nor a named entry on sheet '${region.sheet}' — falling back to 1x1`)
    return null
}

// Draw the rest of a region beside the anchor sprite. Safe to call when there's
// no region, no sprite (an entity built off-map), or the texture isn't loaded —
// each is a no-op, leaving the anchor as-is.
//
// Reads `_regionFrames`, `sprite`, `art` and `tint` off the entity, so any
// entity that sets those can use it regardless of its class. The sprites it
// creates are pushed onto `entity._extraSprites` — plain scene objects with no
// entity of their own, so the caller MUST destroy them when the entity goes or
// the art stays painted on the floor (Prop.destroyExtraSprites).
export function drawRegionExtras(entity) {
    if (!entity._regionFrames || !entity.sprite) return
    const scene = entity.sprite.scene
    const art = resolveArt(entity.art)
    if (!scene || !art || !scene.textures.exists(art.key)) return
    // The anchor is origin(0,0) and exactly one tile wide, so its own position
    // and size give the grid without asking MapState anything.
    const ts = entity.sprite.displayWidth
    const ox = entity.sprite.x, oy = entity.sprite.y
    entity._extraSprites = entity._extraSprites || []
    for (let r = 0; r < entity._regionFrames.length; r++) {
        for (let c = 0; c < entity._regionFrames[r].length; c++) {
            if (r === 0 && c === 0) continue          // the anchor already covers this
            const sprite = scene.add.sprite(ox + c * ts, oy + r * ts, art.key, entity._regionFrames[r][c])
            sprite.setOrigin(0)
            sprite.setScale(entity.sprite.scaleX, entity.sprite.scaleY)
            sprite.setDepth(entity.sprite.depth)
            if (entity.tint) sprite.tint = entity.tint
            entity._extraSprites.push(sprite)
        }
    }
}

// Resolve a THEME ROLE descriptor into everything an entity constructor needs.
// Handles all three descriptor shapes uniformly:
//   { sheet, file }  -> images pack, one sprite            (the generated realm art)
//   { sheet, frame } -> explicit frame, one sprite
//   { sheet, name }  -> a REGION, resolved against the label store; may be
//                       multi-tile, in which case `frames` and `footprint` are set
//
// Returns null when the theme supplies no usable art for the role, which is the
// signal for the caller to keep its historical fallback tile.
export function roleArt(themeRole) {
    if (!themeRole || !themeRole.sheet) return null
    if (themeRole.file != null || Number.isFinite(themeRole.frame)) {
        return { art: themeRole, frames: null, footprint: { w: 1, h: 1 } }
    }
    if (themeRole.name == null) return null
    const resolved = resolveRegion(themeRole)
    if (!resolved) return null
    return {
        art: { sheet: resolved.sheet, frame: resolved.frames[0][0] },
        frames: resolved.frames,
        footprint: { w: resolved.w, h: resolved.h },
        region: { sheet: themeRole.sheet, name: themeRole.name },
    }
}
