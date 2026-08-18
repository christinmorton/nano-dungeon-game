// itemArchive.js — schema + normalization for the item/lore JSON archive (the
// designer's content data store). Same PATTERN as tileReference.*.json (a data
// catalog the tools read) but its own schema. The DESIGNER is the first-class
// editor; the GAME reads it at runtime; a one-off Node script migrates the
// existing lore docs into it. Pure + import-safe (no Phaser, no DOM/network) so
// all three can share this module.
//
// An authored item = an approved Atlas ART reference (data/assetRef.js) + metadata
// (name, lore, slot, category, quest flag, optional passive stats). The prose
// lore docs become design notes; this JSON becomes the source of truth.

export const ITEM_ARCHIVE_FORMAT = "item-archive"
export const ITEM_ARCHIVE_VERSION = 1

// Equipment slots — mirrors GenericItem.SLOT_NAMES, duplicated here as plain
// strings so this module stays import-safe (importing GenericItem would drag in
// Phaser/registry and risk the import-cycle rule). null slot = unequippable
// (quest items, consumables).
export const ITEM_SLOTS = ["mainhand", "offhand", "head", "body", "feet", "gloves", "accessory"]

// Top-level classifier — drives designer grouping now, and which systems treat
// an item how later (a `quest` item wins/advances; `consumable` is used; etc.).
export const ITEM_CATEGORIES = ["weapon", "armor", "consumable", "quest", "misc"]

export function emptyArchive() {
    return { format: ITEM_ARCHIVE_FORMAT, version: ITEM_ARCHIVE_VERSION, items: [] }
}

// Coerce one raw entry to the canonical item shape; unknown fields dropped.
// Returns null when it has no usable key (the stable id).
export function normalizeItem(o) {
    if (!o || typeof o !== "object") return null
    const key = typeof o.key === "string" ? o.key.trim() : ""
    if (!key) return null
    const stats = {}
    if (o.stats && typeof o.stats === "object") {
        for (const [k, v] of Object.entries(o.stats)) if (typeof v === "number") stats[k] = v
    }
    return {
        key,
        name: typeof o.name === "string" ? o.name : key,
        category: ITEM_CATEGORIES.includes(o.category) ? o.category : "misc",
        slot: ITEM_SLOTS.includes(o.slot) ? o.slot : null,
        questItem: !!o.questItem,
        lore: typeof o.lore === "string" ? o.lore : "",
        // art = a full asset-reference (data/assetRef.js) or null. Kept verbatim
        // when it carries a sheet; resolved to entity.art via assetRefToArt at use.
        art: (o.art && typeof o.art === "object" && o.art.sheet) ? o.art : null,
        stats,
    }
}

// Coerce a whole archive (from disk / import) to the canonical shape. Dedups by
// key (last wins), drops invalid entries. Always returns a valid archive.
export function normalizeArchive(json) {
    const out = emptyArchive()
    const raw = json && Array.isArray(json.items) ? json.items : []
    const byKey = new Map()
    for (const o of raw) {
        const it = normalizeItem(o)
        if (it) byKey.set(it.key, it)
    }
    out.items = [...byKey.values()]
    return out
}
