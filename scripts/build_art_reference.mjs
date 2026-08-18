// Registers the original PixelLab art under public/art/<category>/ into images-mode reference files
// (one per top-level category), grouped by sub-folder. Run from code/v3:
//   node scripts/build_art_reference.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"

const ART = "public/art"
const OUT = "src/data"
// items/ (legendaries) is registered separately; _pixellab_test is throwaway.
const CATEGORIES = ["cosmic", "heroes", "monsters", "npcs"]

function camel(name) {
    return name
        .replace(/[''()]/g, "")
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join("")
}

// recursively list .png paths relative to `base`
function walk(base, rel = "") {
    const out = []
    for (const name of readdirSync(`${base}/${rel}` || base)) {
        const r = rel ? `${rel}/${name}` : name
        const full = `${base}/${r}`
        if (statSync(full).isDirectory()) out.push(...walk(base, r))
        else if (name.endsWith(".png")) out.push(r)
    }
    return out
}

// read just the IHDR for a representative pixel size
function pngSize(path) {
    const buf = readFileSync(path)
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

for (const cat of CATEGORIES) {
    const base = `${ART}/${cat}`
    const files = walk(base).sort()
    const groups = {}
    for (const rel of files) {
        const slash = rel.lastIndexOf("/")
        const dir = slash === -1 ? "" : rel.slice(0, slash)
        const fname = rel.slice(slash + 1).replace(/\.png$/, "")
        // group = immediate parent folder (camelCased), or the category itself for root files
        const groupName = dir === "" ? cat : camel(dir.split("/").pop())
        // entry id = filename without a trailing "_south", camelCased
        const id = camel(fname.replace(/_south$/, ""))
        groups[groupName] ??= {}
        let key = id
        let n = 1
        while (groups[groupName][key]) key = id + (++n)
        groups[groupName][key] = { file: rel, note: `art/${cat}/${rel}` }
    }
    const sample = pngSize(`${base}/${files[0]}`)
    const obj = {
        _meta: {
            pack: "original (PixelLab)",
            key: `tileReference.${cat}`,
            mode: "images",
            dir: `art/${cat}`,
            tileSize: sample.w,
            view: "top-down (south pose)",
            license: "Original art generated via PixelLab from text prompts only — owned, free to ship.",
            note: `Original ${cat} sprites. Single south-facing pose per actor (the engine renders one static sprite + tween). Skin-tone variants live under per-actor sub-groups. See documents/v3_actor_art_coverage_audit.md.`,
            referenceDoc: "documents/v3_actor_art_coverage_audit.md"
        },
        ...groups
    }
    writeFileSync(`${OUT}/tileReference.${cat}.json`, JSON.stringify(obj, null, 2) + "\n")
    const count = Object.values(groups).reduce((a, g) => a + Object.keys(g).length, 0)
    console.log(`tileReference.${cat}.json: ${count} sprites across ${Object.keys(groups).length} groups (sample ${sample.w}x${sample.h})`)
}
