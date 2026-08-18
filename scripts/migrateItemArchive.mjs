// migrateItemArchive.mjs — one-off (re-runnable) migration that lifts the coded
// item catalog (src/modules/items/profiles/*.js) into the item/lore archive
// shape (src/data/itemArchive.js). The lore is ALREADY in code as each profile's
// `description`; this just structures it for the designer to edit.
//
// NON-DESTRUCTIVE: writes a REVIEW file (src/data/itemArchive.migrated.json).
// Inspect it, then adopt it as itemArchive.json when happy.
//
// Migrates: key, name, category, slot, lore (= description), art (resolved to an
// asset-reference where the frame is known). Does NOT migrate mechanics
// (damage / stats / range / etc.) — code stays authoritative for behavior
// (the designer-scope principle). Profiles are pure data, so we import them
// directly (no Phaser).
//
// Run from code/v3:  node scripts/migrateItemArchive.mjs

import { readdir, readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { normalizeArchive, ITEM_SLOTS } from "../src/data/itemArchive.js"

const PROFILES_DIR = new URL("../src/modules/items/profiles/", import.meta.url)
const REF_32 = new URL("../src/data/tileReference.32rogues-items.json", import.meta.url)
const OUT = fileURLToPath(new URL("../src/data/itemArchive.migrated.json", import.meta.url))

// name -> frame index for a sheet, from its tileReference JSON (mirrors
// assetLoader.frameIndexFor). We resolve the 32rogues-items sheet (what the gear
// profiles use); file-mode art resolves directly; anything else stays null.
async function frameIndex(refURL) {
    let ref
    try { ref = JSON.parse(await readFile(refURL, "utf8")) } catch { return {} }
    const idx = {}
    for (const [group, entries] of Object.entries(ref)) {
        if (group === "_meta" || !entries || typeof entries !== "object") continue
        for (const [name, entry] of Object.entries(entries)) {
            if (entry && typeof entry === "object" && typeof entry.frame === "number") idx[name] = entry.frame
        }
    }
    return idx
}

function categoryFor(p) {
    if (p.itemClass === "MeleeWeapon" || p.itemClass === "RangedWeapon") return "weapon"
    if (p.itemClass === "Armor" || p.itemClass === "Accessory") return "armor"
    if (p.itemClass === "LightSource") return "misc"
    return "consumable"   // Consumable / Throwable / Draught / Rune / Reagent / Tome / Affinity / Booster / Relic / Deployable
}

function slotFor(p) {
    if (ITEM_SLOTS.includes(p.slot)) return p.slot
    if (p.itemClass === "MeleeWeapon" || p.itemClass === "RangedWeapon") return "mainhand"
    return null
}

function artFor(p, idx32) {
    const a = p.art
    if (a && a.sheet) {
        if (a.file != null) {
            return { path: `${a.sheet}.${a.file}`, sheet: a.sheet, group: a.sheet, name: a.file, entry: { file: a.file } }
        }
        if (a.name != null && a.sheet === "32rogues-items" && idx32[a.name] != null) {
            return { path: `${a.sheet}.${a.name}`, sheet: a.sheet, group: a.sheet, name: a.name, entry: { tile: idx32[a.name] } }
        }
    }
    // No usable art ref, but a legacy Kenney `tile` index → resolve to the
    // "kenney" sheet so it still shows a thumbnail in the Atlas (same sheet the
    // game falls back to for these). Attach nicer art in the designer later.
    if (typeof p.tile === "number") {
        return { path: `kenney.#${p.tile}`, sheet: "kenney", group: "kenney", name: p.name || `#${p.tile}`, entry: { tile: p.tile } }
    }
    return null   // no art at all -> placeholder in the Atlas
}

// Assemble the profile map: single-profile files key by filename; bulk-category
// files export a { key: profile } map that we spread.
async function collectProfiles() {
    const files = (await readdir(PROFILES_DIR)).filter(f => f.endsWith(".js"))
    const map = {}
    const skipped = []
    for (const f of files) {
        let def
        try { def = (await import(new URL(f, PROFILES_DIR))).default } catch (e) { skipped.push(`${f} (${e.message})`); continue }
        if (!def || typeof def !== "object") { skipped.push(`${f} (no default object)`); continue }
        if (def.itemClass && def.name) {
            map[f.replace(/\.js$/, "")] = def
        } else {
            for (const [k, v] of Object.entries(def)) {
                if (v && typeof v === "object" && v.itemClass) map[k] = v
            }
        }
    }
    return { map, skipped }
}

const idx32 = await frameIndex(REF_32)
const { map, skipped } = await collectProfiles()

let withArt = 0, withLore = 0
const items = []
for (const [key, p] of Object.entries(map)) {
    const art = artFor(p, idx32)
    if (art) withArt++
    if (p.description) withLore++
    items.push({
        key, name: p.name || key, category: categoryFor(p), slot: slotFor(p),
        questItem: false, lore: p.description || "", art, stats: {},
    })
}

const archive = normalizeArchive({ format: "item-archive", version: 1, items })
await writeFile(OUT, JSON.stringify(archive, null, 2) + "\n", "utf8")

const byCat = {}
for (const it of archive.items) byCat[it.category] = (byCat[it.category] || 0) + 1
console.log(`Migrated ${archive.items.length} items -> ${OUT}`)
console.log(`  ${withLore} with lore, ${withArt} with resolved art`)
console.log("  by category:", byCat)
console.log("  no resolved art (placeholder):", archive.items.filter(i => !i.art).map(i => i.key).join(", ") || "(none)")
if (skipped.length) console.log("  skipped files:", skipped.join("; "))
