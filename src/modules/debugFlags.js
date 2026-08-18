// Throwaway debug switches for testing — NOT shipped features. Toggle either
// via a URL param (?debughunter) or a console global (window.DEBUG_HUNTER = true
// before a run). Kept in one place so it's easy to find and rip out later.

function flag(globalName, urlKey) {
    if (typeof window === "undefined") return false
    if (window[globalName]) return true
    if (window.location) {
        const p = new URLSearchParams(window.location.search)
        if (p.get(urlKey) != null) return true
    }
    return false
}

// Force ONE rolled enemy per floor to be a hunter (and narrate its hunt to the
// game log), so there's a single observable hunter to watch travel -> search ->
// close in an otherwise normal dungeon. Enemies with a fixed archetype are
// unaffected.
export function hunterDebugOn() {
    return flag("DEBUG_HUNTER", "debughunter")
}

// Run-scoped "have we forced a hunter on this floor yet?" latch. Reset at the
// start of each floor's populate pass (spawnFromTable) so exactly one enemy per
// floor is forced rather than every hunter-capable spawn.
let _forcedThisFloor = false
export function resetForcedHunter() { _forcedThisFloor = false }
export function shouldForceHunter(pool) {
    if (_forcedThisFloor) return false
    if (!hunterDebugOn() || !pool.includes("hunter")) return false
    _forcedThisFloor = true
    return true
}
