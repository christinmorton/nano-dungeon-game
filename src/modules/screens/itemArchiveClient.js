// itemArchiveClient.js — the designer's browser-side access to the item/lore
// JSON archive (data/itemArchive.json). Both calls talk to the dev-only Vite
// endpoint (see vite.config.js) so the browser designer can read + write the
// file on disk despite the sandbox (design: browser front, Node/Vite back —
// the designer OWNS the file; the game separately imports the bundled JSON):
//   loadItemArchive()        → GET  the live file, normalized
//   saveItemArchive(archive) → POST the whole archive back to disk
//
// Dev-only. If the endpoint isn't there (a built page, or Vite not restarted
// after adding the config), load falls back to an empty archive and save warns
// and returns false rather than throwing. Schema + normalization live in the
// pure data/itemArchive.js (shared with the game and the migration script).

import { normalizeArchive, emptyArchive } from "../../data/itemArchive.js"

const ENDPOINT = "/__designer/item-archive"

export async function loadItemArchive() {
    try {
        const res = await fetch(ENDPOINT, { cache: "no-store" })
        if (!res.ok) return emptyArchive()
        return normalizeArchive(await res.json())
    } catch (e) {
        console.warn("[itemArchive] load failed (dev endpoint unavailable? restart Vite)", e)
        return emptyArchive()
    }
}

export async function saveItemArchive(archive) {
    const body = JSON.stringify(normalizeArchive(archive), null, 2)
    try {
        const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        })
        return res.ok
    } catch (e) {
        console.warn("[itemArchive] save failed (dev write endpoint unavailable? restart Vite)", e)
        return false
    }
}
