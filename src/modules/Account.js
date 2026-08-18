import { normalizeCharacter } from "../data/character.js"

const STORAGE_KEY = "nano-dungeon-account"
const VAULT_CAPACITY = 30

// --- Account schema version (documents/v3_hero_roster_and_account_progression.md §11) --
// The stored blob carries `schema`. load() runs a versioned, NON-DESTRUCTIVE
// migration so old flat accounts (schema absent = 0) gain the nested roster model
// without losing any existing field. Bump this + add a `from < N` block to migrate.
const ACCOUNT_SCHEMA_VERSION = 1

// Roster (doc §5). Cap = base living slots + guaranteed account-level unlocks +
// rare item bonuses (the Guild Charter relic → grantRosterSlot).
const BASE_ROSTER_SLOTS = 3

// --- Account level → guaranteed slots (doc §5, §9) --------------------------
// Account level is derived PURELY from lifetime WINS — "complete more runs to
// empower your account". Single source of truth (no separate XP economy; that
// stays parked, doc §7 — the stored `level`/`xp` fields are reserved for a future
// explicit-XP model). NUMBERS BELOW ARE TUNABLE PLACEHOLDERS.
//   - thresholds[i] = cumulative wins to reach level (i + 2).
const ACCOUNT_LEVEL_WIN_THRESHOLDS = [1, 3, 6, 10, 15, 21, 28, 36]
//   - reaching each of these account levels grants +1 guaranteed roster slot.
const ROSTER_SLOT_UNLOCK_LEVELS = [3, 5, 8]

function accountLevelForWins(wins) {
    let level = 1
    for (const t of ACCOUNT_LEVEL_WIN_THRESHOLDS) {
        if (wins >= t) level++
        else break
    }
    return level
}

function guaranteedSlotsForLevel(level) {
    return ROSTER_SLOT_UNLOCK_LEVELS.filter(l => level >= l).length
}

// Immortal lifetime tallies (doc §9) — only ever increment; survive any hero's
// death or deletion. Seeded from the old flat profile counters on migration.
const DEFAULT_LIFETIME = {
    runs: 0,            // total runs attempted (was: runsAttempted)
    wins: 0,            // total runs won (was: runsCompleted)
    kills: 0,
    deepestFloorEver: 0, // (was: bestFloor)
    heroesLost: 0,
    coins: 0,           // (was: lifetimeCoins)
    keys: 0,            // (was: lifetimeKeys)
}

const DEFAULT_PREFERENCES = {
    showPerceptionZones: true,
    showFogOfWar: true,
    hudPosition: "bottom-left",
    heroSpeed: 1,
    // Starting-kit mode (§14 lean-start). false = "build your own" (start with one
    // ability + the ultimate, draft the rest through the run); true = "classic"
    // (start with the full predefined class kit). Read by Dungeon.placePlayer.
    classicKit: false,
    // Run-length preset (run-time budgeting — see documents/v3_dungeon_archetype_system.md
    // §run profiles). Sizes all 5 floors toward a target TOTAL playtime so a run
    // fits a player's intent (a quick phone session vs a desktop sit-down). "free"
    // = the original full-size dungeon. Read by MapState.start. Values:
    // "1min" | "3min" | "5min" | "7min" | "free".
    runLength: "5min",
    // World-camera zoom. WHOLE numbers only (pixelArt: fractional zoom makes
    // pixels uneven/shimmery). Higher = bigger tiles but less of the map visible.
    // Read by World when it sets up the camera; applies on the next floor
    // transition. Values: 2 | 3.
    cameraZoom: 3,
    // Keybind overrides (an InputMap.toConfig() object), or null to use the
    // built-in defaults. Set by the Controls screen; read by InputMap on boot.
    keybinds: null
}

class Account {
    vaultCapacity() {
        return VAULT_CAPACITY
    }

    getPreferences() {
        const a = this.load() || {}
        // Merge defaults so newly-added preferences land on existing accounts
        // without an explicit migration step.
        return { ...DEFAULT_PREFERENCES, ...(a.preferences || {}) }
    }

    setPreference(key, value) {
        const a = this.load() || {}
        a.preferences = { ...DEFAULT_PREFERENCES, ...(a.preferences || {}), [key]: value }
        this.save(a)
    }

    getVault() {
        const a = this.load() || {}
        return Array.isArray(a.vault) ? a.vault : []
    }

    setVault(items) {
        const a = this.load() || {}
        a.vault = items.slice(0, VAULT_CAPACITY)
        this.save(a)
    }

    clearVault() {
        const a = this.load() || {}
        a.vault = []
        this.save(a)
    }

    // --- Skillbook account book (§14 B3) ---------------------------------------
    // A FLAT list of permanently-learned ability/trait KEYS (registry keys like
    // "Cleave"/"FrostBolt", NOT display names — names can be renamed, keys are
    // stable). NOT a skill tree. Written only on extraction (a surviving/winning
    // run) via commitLearned; the pre-run loadout (B4) reads it back to assemble
    // the bar from the account collection.
    //
    // ROADMAP (doc §7/§13 phase 2): this flat book moves ONTO the Character (a
    // hero owns its learned kit). Kept intact this phase so the current loadout /
    // BaseHero / Intro paths behave exactly as before — no behavior change yet.

    getLearnedAbilities() {
        const a = this.load() || {}
        return Array.isArray(a.learnedAbilities) ? a.learnedAbilities : []
    }

    getLearnedTraits() {
        const a = this.load() || {}
        return Array.isArray(a.learnedTraits) ? a.learnedTraits : []
    }

    // Merge a run's freshly-learned ability/trait keys into the permanent book
    // (deduped, order-preserving). Called on extraction — death-lost runs never
    // reach here, so the run's gains are dropped (extraction-gated persistence).
    // Returns the new totals so the caller can report what was banked.
    commitLearned({ abilities = [], traits = [] } = {}) {
        const a = this.load() || {}
        const mergeKeys = (existing, incoming) => {
            const out = Array.isArray(existing) ? existing.slice() : []
            for (const key of incoming) if (key && !out.includes(key)) out.push(key)
            return out
        }
        a.learnedAbilities = mergeKeys(a.learnedAbilities, abilities)
        a.learnedTraits = mergeKeys(a.learnedTraits, traits)
        this.save(a)
        return { learnedAbilities: a.learnedAbilities, learnedTraits: a.learnedTraits }
    }

    // --- Roster model (doc §3–§5, §8) ------------------------------------------
    // NEW nested progression model. All INERT this phase: the accessors exist and
    // the migration builds the shape, but nothing in the run loop reads/writes a
    // Character yet (that's phase 2+). Added now so the vessel is complete and the
    // CRUD is headless-testable.

    // The LIVING roster (playable heroes).
    getCharacters() {
        const a = this.load() || {}
        return Array.isArray(a.characters) ? a.characters.map(normalizeCharacter).filter(Boolean) : []
    }

    // The FALLEN wall (permadeath memorials; revivable via the rare item, doc §8).
    getFallen() {
        const a = this.load() || {}
        return Array.isArray(a.fallen) ? a.fallen.map(normalizeCharacter).filter(Boolean) : []
    }

    getCharacter(id) {
        return this.getCharacters().find(c => c.id === id) || null
    }

    // Extra roster slots granted by rare expansion items (doc §5). The account-level
    // guaranteed curve is layered on top in a later phase.
    getBonusRosterSlots() {
        const a = this.load() || {}
        return typeof a.bonusRosterSlots === "number" ? a.bonusRosterSlots : 0
    }

    // Living-roster capacity = base + guaranteed account-level unlocks + item bonuses.
    rosterCap() {
        return BASE_ROSTER_SLOTS
            + guaranteedSlotsForLevel(this.getAccountLevel())
            + this.getBonusRosterSlots()
    }

    rosterSlotsFree() {
        return Math.max(0, this.rosterCap() - this.getCharacters().length)
    }

    // Permanently add roster slot(s) — the effect of the rare Guild Charter relic
    // (doc §5). Stored separately from the account-level unlocks so the two stack.
    grantRosterSlot(n = 1) {
        const a = this.load() || {}
        a.bonusRosterSlots = (typeof a.bonusRosterSlots === "number" ? a.bonusRosterSlots : 0) + n
        this.save(a)
        return this.rosterCap()
    }

    // Named intent the Guild Charter item calls (Consumable._grantRosterSlot).
    redeemRosterExpansion(n = 1) {
        return this.grantRosterSlot(n)
    }

    // Account level — derived from lifetime wins (see the table above).
    getAccountLevel() {
        return accountLevelForWins(this.getLifetime().wins)
    }

    // Progress snapshot for the future Guild Hall UI: current level, wins toward the
    // next level, roster-cap breakdown, and the next slot-unlock milestone.
    accountProgress() {
        const wins = this.getLifetime().wins
        const level = accountLevelForWins(wins)
        const nextThreshold = ACCOUNT_LEVEL_WIN_THRESHOLDS[level - 1]  // wins for level+1
        const atMax = nextThreshold == null
        return {
            level,
            wins,
            winsForNext: atMax ? null : nextThreshold,
            winsRemaining: atMax ? 0 : Math.max(0, nextThreshold - wins),
            atMaxLevel: atMax,
            rosterCap: this.rosterCap(),
            guaranteedSlots: guaranteedSlotsForLevel(level),
            bonusSlots: this.getBonusRosterSlots(),
            nextSlotLevel: ROSTER_SLOT_UNLOCK_LEVELS.find(l => l > level) ?? null,
        }
    }

    getLifetime() {
        const a = this.load() || {}
        return { ...DEFAULT_LIFETIME, ...(a.lifetime || {}) }
    }

    // Add a freshly-committed hero to the living roster (save-on-win, doc §4.1).
    // Refuses when the roster is full; returns the stored character or null.
    addCharacter(character) {
        const c = normalizeCharacter(character)
        if (!c) return null
        const a = this.load() || {}
        if (!Array.isArray(a.characters)) a.characters = []
        if (a.characters.length >= this.rosterCap()) return null
        c.status = "living"
        a.characters.push(c)
        this.save(a)
        return c
    }

    // Update a living hero in place (continue-a-hero commit, doc §4.1). `patch` is
    // either a partial object merged onto the stored character, or a function
    // (current) => next. Returns the updated character or null if not found.
    updateCharacter(id, patch) {
        const a = this.load() || {}
        const list = Array.isArray(a.characters) ? a.characters : []
        const idx = list.findIndex(c => c && c.id === id)
        if (idx < 0) return null
        const current = normalizeCharacter(list[idx])
        const next = typeof patch === "function" ? patch(current) : { ...current, ...patch }
        // Class + id are immutable identity — never let a patch reassign them.
        const merged = normalizeCharacter({ ...next, id: current.id, class: current.class })
        if (!merged) return null
        list[idx] = merged
        a.characters = list
        this.save(a)
        return merged
    }

    // Permadeath (doc §4.2): move a living hero to the Fallen wall with a frozen
    // final record. Increments the immortal heroesLost tally. Returns the fallen
    // character or null if not found.
    killCharacter(id, deathRecord = null) {
        const a = this.load() || {}
        const list = Array.isArray(a.characters) ? a.characters : []
        const idx = list.findIndex(c => c && c.id === id)
        if (idx < 0) return null
        const fallen = normalizeCharacter(list[idx])
        if (!fallen) return null
        fallen.status = "fallen"
        if (deathRecord) fallen.history = [...fallen.history, deathRecord].map(r => r).filter(Boolean)
        list.splice(idx, 1)
        a.characters = list
        if (!Array.isArray(a.fallen)) a.fallen = []
        a.fallen.push(fallen)
        a.lifetime = { ...DEFAULT_LIFETIME, ...(a.lifetime || {}) }
        a.lifetime.heroesLost += 1
        this.save(a)
        return fallen
    }

    // Revive (doc §8): pull a hero from the Fallen wall back to the living roster,
    // SLOT PERMITTING. Returns the revived character or null (not found / no slot).
    reviveCharacter(id) {
        const a = this.load() || {}
        const fallenList = Array.isArray(a.fallen) ? a.fallen : []
        const idx = fallenList.findIndex(c => c && c.id === id)
        if (idx < 0) return null
        if (this.rosterSlotsFree() <= 0) return null
        const revived = normalizeCharacter(fallenList[idx])
        if (!revived) return null
        revived.status = "living"
        fallenList.splice(idx, 1)
        a.fallen = fallenList
        if (!Array.isArray(a.characters)) a.characters = []
        a.characters.push(revived)
        this.save(a)
        return revived
    }

    // --- Revive tokens (doc §8) — the rare revive relic's currency --------------
    // Using an Ember of Return banks a token here (Consumable._grantReviveToken).
    // The Guild Hall (doc §13 phase 6) SPENDS one on a chosen fallen hero via
    // reviveHero. Decoupled find-from-use because reviving needs a TARGET (which
    // fallen hero) that only the Hall UI can pick.

    getReviveTokens() {
        const a = this.load() || {}
        return typeof a.reviveTokens === "number" ? a.reviveTokens : 0
    }

    grantReviveToken(n = 1) {
        const a = this.load() || {}
        a.reviveTokens = (typeof a.reviveTokens === "number" ? a.reviveTokens : 0) + n
        this.save(a)
        return this.getReviveTokens()
    }

    // Spend a revive token to pull a chosen fallen hero back to the living roster.
    // Gated on: a token in hand AND a free roster slot AND the id being on the
    // Fallen wall. The token is consumed ONLY on a successful revive (a failed
    // attempt — no slot / bad id — costs nothing). Returns a result object so the
    // Hall UI can message the reason. reviveCharacter enforces slot + existence.
    reviveHero(id) {
        if (this.getReviveTokens() <= 0) return { ok: false, reason: "no-token" }
        const revived = this.reviveCharacter(id)
        if (!revived) {
            const stillFallen = this.getFallen().some(c => c.id === id)
            return { ok: false, reason: stillFallen ? "no-slot" : "not-found" }
        }
        const a = this.load() || {}
        a.reviveTokens = Math.max(0, (typeof a.reviveTokens === "number" ? a.reviveTokens : 0) - 1)
        this.save(a)
        return { ok: true, character: revived, tokensLeft: a.reviveTokens }
    }

    // --- Storage + versioned migration -----------------------------------------

    // Upgrade any stored blob to the current schema, NON-DESTRUCTIVELY (every old
    // field is preserved so existing getters behave identically). Lazy: applied
    // in-memory on every load and persisted the next time any setter save()s the
    // already-migrated object — load() itself stays side-effect-free.
    migrate(raw) {
        const a = raw && typeof raw === "object" ? { ...raw } : {}
        const from = typeof a.schema === "number" ? a.schema : 0

        if (from < 1) {
            // Fold the flat profile counters into the immortal lifetime tallies
            // (doc §11). The old fields are LEFT IN PLACE — getBest()/recordRun()
            // still read them this phase; lifetime shadows them going forward.
            a.lifetime = {
                ...DEFAULT_LIFETIME,
                runs: a.runsAttempted || 0,
                wins: a.runsCompleted || 0,
                deepestFloorEver: a.bestFloor || 0,
                coins: a.lifetimeCoins || 0,
                keys: a.lifetimeKeys || 0,
                ...(a.lifetime || {}),
            }
            // Scaffold the roster model (empty — heroes are minted in phase 2).
            if (!Array.isArray(a.characters)) a.characters = []
            if (!Array.isArray(a.fallen)) a.fallen = []
            if (typeof a.level !== "number") a.level = 1
            if (typeof a.xp !== "number") a.xp = 0
            if (typeof a.bonusRosterSlots !== "number") a.bonusRosterSlots = 0
        }

        // Idempotent normalization (safe on already-current blobs too).
        a.lifetime = { ...DEFAULT_LIFETIME, ...(a.lifetime || {}) }
        a.characters = (Array.isArray(a.characters) ? a.characters : [])
            .map(normalizeCharacter).filter(Boolean)
        a.fallen = (Array.isArray(a.fallen) ? a.fallen : [])
            .map(normalizeCharacter).filter(Boolean)
        a.schema = ACCOUNT_SCHEMA_VERSION
        return a
    }

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            const parsed = raw ? JSON.parse(raw) : null
            // Preserve the "no account yet" signal (null) so first-run name entry
            // still triggers; only migrate a real stored blob.
            return parsed ? this.migrate(parsed) : null
        } catch (e) {
            return null
        }
    }

    save(account) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(account))
        } catch (e) {
            // localStorage may be unavailable (private mode, quota); silently skip.
        }
    }

    getUsername() {
        const a = this.load()
        return a && a.username ? a.username : null
    }

    setUsername(username) {
        const a = this.load() || {}
        a.username = username
        if (!a.createdAt) a.createdAt = new Date().toISOString()
        if (typeof a.bestScore !== "number") a.bestScore = 0
        if (typeof a.bestFloor !== "number") a.bestFloor = 0
        if (typeof a.runsCompleted !== "number") a.runsCompleted = 0
        if (typeof a.runsAttempted !== "number") a.runsAttempted = 0
        this.save(a)
    }

    getBest() {
        const a = this.load() || {}
        return {
            score: a.bestScore || 0,
            floor: a.bestFloor || 0,
            runsCompleted: a.runsCompleted || 0,
            runsAttempted: a.runsAttempted || 0
        }
    }

    clearProfile() {
        try {
            localStorage.removeItem(STORAGE_KEY)
        } catch (e) {
            // localStorage may be unavailable (private mode, quota); silently skip.
        }
    }

    recordRun(stats, outcome) {
        const a = this.load() || {}
        const previousBest = a.bestScore || 0
        const previousBestFloor = a.bestFloor || 0
        const score = stats.score || 0
        let isNewBest = false
        if (score > previousBest) {
            a.bestScore = score
            a.bestFloor = stats.deepestFloor || 0
            isNewBest = true
        }
        a.runsAttempted = (a.runsAttempted || 0) + 1
        if (outcome === "win") {
            a.runsCompleted = (a.runsCompleted || 0) + 1
        }
        a.lifetimeCoins = (a.lifetimeCoins || 0) + (stats.coins || 0)
        a.lifetimeKeys = (a.lifetimeKeys || 0) + (stats.keys || 0)

        // Mirror into the immortal lifetime tallies (doc §9). These shadow the flat
        // counters and are the go-forward source of truth; kept in sync here so the
        // new roster UI can read them without waiting on the phase-2 rewire.
        const life = { ...DEFAULT_LIFETIME, ...(a.lifetime || {}) }
        life.runs += 1
        if (outcome === "win") life.wins += 1
        life.kills += stats.kills || 0
        life.coins += stats.coins || 0
        life.keys += stats.keys || 0
        life.deepestFloorEver = Math.max(life.deepestFloorEver, stats.deepestFloor || 0)
        a.lifetime = life

        this.save(a)
        return { isNewBest, previousBest, previousBestFloor, account: a }
    }
}

export default new Account()
