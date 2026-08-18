// One-shot generator: turns the 32rogues .txt manifests into tileReference sheet files.
// The manifest labels "N.x" map directly onto the sprite grid: row = N-1, col = (x - 'a').
// Run from code/v3:  node scripts/build_32rogues_reference.mjs
import { readFileSync, writeFileSync } from "node:fs"

const PUB = "public/32rogues-0.5.0/32rogues"
const OUT = "src/data"

// camelCase a manifest label like "short sword 2" -> "shortSword2"
function camel(name) {
    return name
        .replace(/[''()/]/g, "")
        .trim()
        .split(/[\s-]+/)
        .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join("")
}

// Parse a manifest into [{section, letter, name}], skipping blank lines.
function parseManifest(path) {
    const out = []
    for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
        const m = raw.match(/^\s*(\d+)\.([a-z])\.\s+(.+?)\s*$/)
        if (m) out.push({ section: parseInt(m[1]), letter: m[2], name: m[3] })
    }
    return out
}

function buildSheet({ key, sheet, columns, license, manifest, sectionGroup, fixes = {} }) {
    const entries = parseManifest(`${PUB}/${manifest}`)
    const groups = {}
    const seen = {}
    for (const e of entries) {
        const fix = fixes[`${e.section}.${e.letter}`]
        let row = fix?.row ?? e.section - 1
        const col = e.letter.charCodeAt(0) - 97
        const frame = row * columns + col
        const group = sectionGroup(fix?.section ?? e.section)
        let id = camel(e.name)
        // de-dup names (e.g. two "silver signet ring")
        if (seen[group + "." + id]) id = id + (++seen[group + "." + id])
        else seen[group + "." + id] = 1
        groups[group] ??= {}
        groups[group][id] = { frame, col, row, note: `32rogues ${e.section}.${e.letter} ${e.name}` }
    }
    const obj = {
        _meta: {
            pack: "32rogues",
            key,
            sheet: `32rogues-0.5.0/32rogues/${sheet}`,
            manifestSource: `32rogues-0.5.0/32rogues/${manifest}`,
            tileSize: 32,
            spacing: 0,
            columns,
            license: "Commercial OK; NO AI/ML input; no NFT/blockchain; no redistribute/resell. (c) 2024 Seth Boyles.",
            view: "side / item-icon",
            formula: { frameFromRowCol: `index = row * ${columns} + col` },
            verification: "Positions derived from manifest 'N.x' labels (row = N-1, col = letter). Verify in TestScreen before wiring into game code.",
            referenceDoc: "documents/v3_item_prop_art_coverage_audit.md"
        },
        ...groups
    }
    writeFileSync(`${OUT}/${key}.json`, JSON.stringify(obj, null, 2) + "\n")
    const count = Object.values(groups).reduce((n, g) => n + Object.keys(g).length, 0)
    console.log(`${key}.json: ${count} sprites across ${Object.keys(groups).length} groups`)
}

// ---- items.png (11 cols x 26 rows) ----
buildSheet({
    key: "tileReference.32rogues-items",
    sheet: "items.png",
    columns: 11,
    manifest: "items.txt",
    // "25.e bottle of water" is a typo for 26.e (it's in the food row).
    fixes: { "25.e": { row: 25, section: 26 } },
    sectionGroup: (s) => {
        if (s >= 1 && s <= 11) return "weapons"
        if (s === 12) return "offhand"
        if (s === 13) return "armorBody"
        if (s === 14) return "armorGloves"
        if (s === 15) return "armorFeet"
        if (s === 16) return "armorHead"
        if (s >= 17 && s <= 19) return "accessories"
        if (s >= 20 && s <= 21) return "potions"
        if (s === 22) return "booksAndScrolls"
        if (s === 23) return "keys"
        if (s === 24) return "ammo"
        if (s === 25) return "currency"
        if (s === 26) return "food"
        return "misc"
    }
})

// ---- tiles.png (17 cols x 26 rows) ----
buildSheet({
    key: "tileReference.32rogues-tiles",
    sheet: "tiles.png",
    columns: 17,
    manifest: "tiles.txt",
    sectionGroup: (s) => {
        if (s >= 1 && s <= 6) return "walls"
        if (s >= 7 && s <= 16) return "floors"
        if (s === 17) return "doorsStairsHazards"
        if (s === 18) return "containers"
        if (s === 19) return "rocks"
        if (s === 20) return "crops"
        if (s === 21) return "mushrooms"
        if (s === 22) return "corpses"
        if (s === 23) return "bloodAndSlime"
        if (s === 24) return "coffinsAndTombs"
        if (s === 26) return "trees"
        return "misc"
    }
})
