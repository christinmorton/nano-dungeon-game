// Theme roles — how a floor's THEME supplies art for the mechanic-tied props.
//
// The problem this solves: stairs, chests, doors, shrines, fonts, portals and
// the loot bag all had their art hardcoded as Kenney frame numbers
// (Stairs 297/296, Container 302/241, Shrine 834, Door 497/447/500, ...). Every
// realm therefore used the same grey Kenney sprite no matter what the floor was
// painted with — a snowfield and a candlelit hall both got the same staircase.
//
// A theme can now name art per ROLE. The value is just an art descriptor of the
// shape resolveArt() already understands:
//
//   { sheet: "realm", file: "stairs-down-castle-town.png" }   // images pack
//   { sheet: "castletown", name: "chest-white" }              // named region/frame
//   { sheet: "kenney", frame: 302 }                           // explicit frame
//
// so no new render path is needed — the entity sets `this.art` and the existing
// PNG pipeline draws it.
//
// FALLBACK IS THE WHOLE DESIGN. Every consumer passes its historical Kenney tile
// as the fallback, and a theme that names no roles behaves exactly as it did.
// That is what lets roles ship incrementally: stairs have art for all 8 realms
// today, portals and the loot bag have none anywhere, and both states are fine.
//
// LEAF MODULE — no imports. Entity classes (Stairs, Container, Shrine…) are deep
// in the BaseEnemy/GenericItem init chain, and pulling MapState or the recipe
// graph in from there is exactly the import cycle this codebase keeps hitting.
// Callers pass the theme in; this module only reads it.

// The roles a theme may supply. Kept as an explicit list so the designer can
// enumerate them and so a typo in a dungeon type fails loudly in validation
// rather than silently painting the fallback forever.
export const THEME_ROLES = [
    "stairsDown", "stairsUp",
    "chest", "bag",
    "doorClosed", "doorOpen", "doorLocked",
    "passageHidden", "passageOpen",
    "portalActive", "portalHidden",
    "shrine", "font",
]

const ROLE_SET = new Set(THEME_ROLES)

// An art descriptor is usable if it names a sheet plus one way to find the art.
function validArt(a) {
    return !!(a && typeof a === "object" && typeof a.sheet === "string" && a.sheet
        && (typeof a.file === "string" || typeof a.name === "string" || Number.isFinite(a.frame)))
}

// Drop unknown role keys and malformed descriptors. A bad entry becomes "no
// role", which falls back — never a half-formed art object that would render as
// a missing texture.
export function normalizeRoles(raw) {
    if (!raw || typeof raw !== "object") return null
    const out = {}
    for (const [role, art] of Object.entries(raw)) {
        if (!ROLE_SET.has(role) || !validArt(art)) continue
        out[role] = { sheet: art.sheet }
        if (art.file != null) out[role].file = art.file
        if (art.name != null) out[role].name = art.name
        if (Number.isFinite(art.frame)) out[role].frame = art.frame
    }
    return Object.keys(out).length ? out : null
}

// THE ACCESSOR. Returns an art descriptor for `role` on `theme`, or null when the
// theme doesn't supply one — in which case the caller keeps its Kenney tile.
export function themeArt(theme, role) {
    const roles = theme && theme.roles
    if (!roles) return null
    const art = roles[role]
    return validArt(art) ? art : null
}

// Convenience for entity constructors, which all take (tile, tint, art) and want
// "the themed art if there is any, otherwise nothing". Reads the CURRENT floor's
// theme, which the caller supplies — see the note about leaf-module purity above.
export function roleArt(theme, role) {
    return themeArt(theme, role)
}

// Build a roles object for a realm whose stairs live in the `realm` images pack.
// Every dungeon type with generated stair art calls this, so the file-naming
// convention lives in exactly one place.
export function realmStairs(realmKey) {
    return {
        stairsDown: { sheet: "realm", file: `stairs-down-${realmKey}.png` },
        stairsUp: { sheet: "realm", file: `stairs-up-${realmKey}.png` },
    }
}
