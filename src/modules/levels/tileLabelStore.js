// tileLabelStore.js — the one place the tile-label data is read from.
//
// The bundled JSON is a SNAPSHOT taken when the page boots. That's correct for
// the built game (the file ships with the bundle and never changes at runtime),
// but wrong for the designer, where the Atlas is editing that same file live
// through the dev endpoint. Before this module existed, autotile.js and
// tileRegions.js each imported the JSON directly, so renaming a terrain in the
// Atlas updated the Atlas and nothing else: the Floor-theme "Autotile ground"
// dropdown and MapState's painting both kept serving the boot-time names until
// the page was reloaded.
//
// So: the bundled import is the DEFAULT, and the designer may replace it with
// what it just saved. Consumers read through tileLabelStore() and get whichever
// is current. The built game never calls the setter and behaves exactly as
// before.

import bundled from "../../data/tileLabels.json"

let current = bundled
const listeners = new Set()

export function tileLabelStore() { return current }

// Replace the live store — called by the Atlas after every successful save, with
// the same object it just persisted. Normalized to the full shape so consumers
// never have to guard against a missing `labels` or `regions` key.
export function setTileLabelStore(store) {
    current = {
        format: "tile-labels",
        version: 2,
        labels: (store && store.labels) || {},
        regions: (store && store.regions) || {},
    }
    for (const fn of listeners) fn(current)
}

// Notify when the store changes, for anything that caches derived data rather
// than recomputing per read. Returns an unsubscribe.
export function onTileLabelsChanged(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
}
