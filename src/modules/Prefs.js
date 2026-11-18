// Player settings, persisted to localStorage.
//
// v3 read these off Account.js, which also carried the whole meta-progression
// layer - banked abilities, the hero roster, run records. The scope doc cuts that
// layer (section 6), but it does NOT cut settings: a fog toggle and a keybind map
// are UI state, not progression. So the progression half is gone and this is what
// is left, which is most of what the call sites actually wanted.
//
// Deliberately absent: getLearnedAbilities(). That was the account ability book,
// and BaseHero.applyAccountBook is removed with it.
const STORAGE_KEY = "v5.prefs"

const DEFAULTS = {
    showFogOfWar: true,
    heroSpeed: 1,
    keybinds: null,
    // Whole numbers only — pixelArt makes fractional zoom shimmer. Higher = bigger
    // tiles but less of the map visible.
    cameraZoom: 3,
    // Debug overlay: draws each enemy's perception radius and vision cone.
    showPerceptionZones: false,
    // Which corner the HUD box sits in.
    hudPosition: "bottom-left",
    // Audio. Master scales both channels; muted short-circuits everything.
    // Music sits below effects by default because the loops are continuous and
    // the effects need to cut through them.
    masterVolume: 1,
    musicVolume: 0.5,
    sfxVolume: 0.8,
    muted: false,
}

class Prefs {
    constructor() {
        this._cache = null
    }

    getPreferences() {
        if (this._cache) return this._cache
        let stored = {}
        try {
            if (typeof localStorage !== "undefined") {
                const raw = localStorage.getItem(STORAGE_KEY)
                if (raw) stored = JSON.parse(raw) || {}
            }
        } catch (e) {
            // Unreadable or malformed storage falls back to defaults rather than
            // throwing - a corrupt settings blob must never stop the game booting.
            stored = {}
        }
        this._cache = { ...DEFAULTS, ...stored }
        return this._cache
    }

    setPreference(key, value) {
        const prefs = this.getPreferences()
        prefs[key] = value
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
            }
        } catch (e) { /* non-fatal: the in-memory value still applies this session */ }
        return value
    }
}

export default new Prefs()
