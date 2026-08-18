// Rank — a universal F→S rating scale, stamped on any noun so a "rank" reads the
// same everywhere. Items are the first consumer; abilities, quests/missions,
// areas/rooms, difficulty, and levels can adopt the SAME scale later (this is
// the point — one scale, one display, one comparison). Generalizes the kind of
// thing the enemy `tier`/`rarity` fields do today.
//
// The scale is ordered low→high. SS/SSS can be appended later without touching
// callers (they compare by index, not hard-coded letters).

const SCALE = [
    { key: 'F', label: 'F', color: '#9aa0a6' }, // grey — bottom
    { key: 'E', label: 'E', color: '#b9c0a8' }, // pale
    { key: 'D', label: 'D', color: '#6abf69' }, // green
    { key: 'C', label: 'C', color: '#4aa3df' }, // blue
    { key: 'B', label: 'B', color: '#a06ee1' }, // purple
    { key: 'A', label: 'A', color: '#e6a23c' }, // orange
    { key: 'S', label: 'S', color: '#f2d24b' }, // gold — top
]

const BY_KEY = Object.fromEntries(SCALE.map((r, i) => [r.key, { ...r, index: i }]))
export const RANK_KEYS = SCALE.map(r => r.key)
export const LOWEST = SCALE[0].key
export const HIGHEST = SCALE[SCALE.length - 1].key

// Resolve a rank key to its { key, label, color, index }. Unknown keys fall back
// to the lowest rank so callers never get undefined.
export function rank(key) {
    return BY_KEY[key] || BY_KEY[LOWEST]
}

// The rank at an ordinal position (clamped into range). Lets a noun map a 0-based
// quality score straight onto the scale: rankByIndex(score).
export function rankByIndex(i) {
    const clamped = Math.max(0, Math.min(SCALE.length - 1, Math.floor(i)))
    return { ...SCALE[clamped], index: clamped }
}

// Bump a rank up (or down, with a negative amount) by N steps, clamped.
export function rankStep(key, steps) {
    return rankByIndex(rank(key).index + steps)
}

// Ordering: negative if a < b, positive if a > b, 0 if equal. (By scale position.)
export function compareRanks(a, b) {
    return rank(a).index - rank(b).index
}

export function rankColor(key) { return rank(key).color }
export function rankLabel(key) { return rank(key).label }
