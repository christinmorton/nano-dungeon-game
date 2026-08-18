import { defineConfig } from "vite"
import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

// Dev-only middleware that lets the Dungeon Designer OWN JSON data files. The
// designer runs in the browser (can't touch the filesystem), so the write side
// lives here in Node/Vite (design: browser front, Node back). Each route exposes:
//   GET  → the file's current JSON (live disk read, so edits show without rebuild)
//   POST → overwrite the file with the posted JSON (validated before writing so a
//          bad body never corrupts the file)
// `apply: "serve"` + configureServer means these only exist in `vite dev`; the
// built game never sees them and just imports the bundled JSON. Adding this config
// is otherwise a no-op — root/MPA/build defaults are unchanged.
//
// NOTE: adding or changing this file requires a Vite RESTART (config is read once
// at startup, not hot-reloaded).

const ITEM_ARCHIVE_PATH = fileURLToPath(new URL("./src/data/itemArchive.json", import.meta.url))
const ITEM_ARCHIVE_EMPTY = '{\n  "format": "item-archive",\n  "version": 1,\n  "items": []\n}\n'

const TILE_LABELS_PATH = fileURLToPath(new URL("./src/data/tileLabels.json", import.meta.url))
const TILE_LABELS_EMPTY = '{\n  "format": "tile-labels",\n  "version": 2,\n  "labels": {},\n  "regions": {}\n}\n'

// A dev endpoint that reads/overwrites one JSON file on disk (GET/POST). Shared
// so every designer-owned data file (item archive, tile labels, …) wires the
// same way — the browser client just picks the route.
function designerFileEndpoint(name, route, path, empty) {
    return {
        name,
        apply: "serve",
        configureServer(server) {
            server.middlewares.use(route, async (req, res) => {
                try {
                    if (req.method === "GET") {
                        const txt = await readFile(path, "utf8").catch(() => empty)
                        res.setHeader("Content-Type", "application/json")
                        res.end(txt)
                        return
                    }
                    if (req.method === "POST") {
                        let body = ""
                        for await (const chunk of req) body += chunk
                        const parsed = JSON.parse(body)   // throws → 400, file untouched
                        await writeFile(path, JSON.stringify(parsed, null, 2) + "\n", "utf8")
                        res.statusCode = 200
                        res.setHeader("Content-Type", "application/json")
                        res.end('{"ok":true}')
                        return
                    }
                    res.statusCode = 405
                    res.end()
                } catch (e) {
                    res.statusCode = 400
                    res.setHeader("Content-Type", "application/json")
                    res.end(JSON.stringify({ ok: false, error: String(e) }))
                }
            })
        },
    }
}

export default defineConfig({
    plugins: [
        designerFileEndpoint("designer-item-archive", "/__designer/item-archive", ITEM_ARCHIVE_PATH, ITEM_ARCHIVE_EMPTY),
        designerFileEndpoint("designer-tile-labels", "/__designer/tile-labels", TILE_LABELS_PATH, TILE_LABELS_EMPTY),
    ],
})
