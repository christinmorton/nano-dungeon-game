// character.js — schema + normalization for a HERO (Character): the unit of
// progression in the account rebuild (see documents/v3_hero_roster_and_account_progression.md).
// Same PATTERN as data/itemArchive.js (a pure schema+normalize module the game and
// tools share). Pure + import-safe (no Phaser, no DOM, no ability registry) so it
// can be imported anywhere — including from Account.js, which core singletons pull.
//
// The account is the PERMANENT spine (roster + shared vault + scoreboard); a
// Character is the VOLATILE, permadeath hero. A character keeps its identity
// (name + IMMUTABLE class), its learned kit (ability/trait registry KEYS), its
// stats, its backstory (structured motivation + prose lore), and a per-run history.
//
// Fields marked "(inert)" exist now so the future hero-level economy (doc §7) and
// difficulty scaling (doc §10) attach later WITHOUT a migration — the vessel is
// built forward-compatible; the behavior is filled in by a later phase.

export const CHARACTER_FORMAT = "character"
export const CHARACTER_VERSION = 1

// Living roster vs the Fallen wall (doc §8). A character is exactly one of these.
export const CHARACTER_STATUS = ["living", "fallen"]

// How a run ended — recorded per run on the hero (doc §3.3). "death" is permadeath.
export const RUN_OUTCOMES = ["win", "death", "abandoned"]

// Structured hero MOTIVATION (doc §6) — the machine-readable half of the backstory.
// SYSTEMS consume this (bark selector, quest gating); prose `lore` is display-only.
// Closed, small, behavior-driving. Extend deliberately (barks/quests key off it).
export const MOTIVATIONS = [
    "vengeance", "glory", "redemption", "greed", "duty", "curiosity", "survival", "faith",
]
export const DEFAULT_MOTIVATION = "glory"

// How a backstory came to be (doc §6 seam). Shape is identical either way; this
// just records provenance. "authored" = picked/written at creation; "generated" =
// the parked backstory-gen reward.
export const BACKSTORY_ORIGINS = ["authored", "generated"]

// A fresh, unique id for a minted hero. Runtime-only (Date/Math are fine in the
// game, unlike workflow scripts). Callers may pass their own id to normalizeCharacter.
export function makeCharacterId() {
    const rand = Math.random().toString(36).slice(2, 8)
    return `hero_${Date.now().toString(36)}_${rand}`
}

// --- Backstory --------------------------------------------------------------
export function makeBackstory(partial = {}) {
    return normalizeBackstory(partial)
}

export function normalizeBackstory(o) {
    const b = o && typeof o === "object" ? o : {}
    return {
        // STRUCTURED — the tag systems read. Falls back to a valid default so barks
        // always have something to key off (doc §6: foundation needs a placeholder).
        motivation: MOTIVATIONS.includes(b.motivation) ? b.motivation : DEFAULT_MOTIVATION,
        // PROSE — display-only, never parsed.
        lore: typeof b.lore === "string" ? b.lore : "",
        origin: BACKSTORY_ORIGINS.includes(b.origin) ? b.origin : "authored",
    }
}

// --- Run record (data ON the hero, not inheritance) -------------------------
// One per run the hero attempts. Reuses the seed + play-time instruments already
// produced by Run.js (floorRecords / runSeconds) and the seed-save machinery.
export function normalizeRunRecord(o) {
    if (!o || typeof o !== "object") return null
    const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0)
    return {
        seed: o.seed != null ? o.seed : null,
        outcome: RUN_OUTCOMES.includes(o.outcome) ? o.outcome : "abandoned",
        deepestFloor: num(o.deepestFloor),
        kills: num(o.kills),
        itemsFound: num(o.itemsFound),
        seconds: num(o.seconds),
        rounds: num(o.rounds),
        // Set on a death record — feeds the tombstone on the Fallen wall (doc §8).
        killedBy: typeof o.killedBy === "string" ? o.killedBy : null,
        date: typeof o.date === "string" ? o.date : null,
    }
}

// --- Character --------------------------------------------------------------
// Mint a brand-new living hero of a class. `class` is set once here and is
// IMMUTABLE thereafter (doc §ID: born a Warrior, always a Warrior).
export function makeCharacter({ heroClass, name, motivation, lore } = {}) {
    return normalizeCharacter({
        id: makeCharacterId(),
        name: name || "Unnamed Hero",
        class: heroClass || null,
        status: "living",
        createdAt: new Date().toISOString(),
        backstory: { motivation, lore, origin: "authored" },
    })
}

// Coerce a raw/stored/partial object to the canonical character shape. Idempotent
// (safe to run on an already-normalized character). Returns null only when it has
// no usable id (the stable key everything hangs off). Unknown fields are dropped.
export function normalizeCharacter(o) {
    if (!o || typeof o !== "object") return null
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : null
    if (!id) return null

    // Registry KEYS only (stable ids like "Cleave"), never display names — names
    // can be renamed, keys are stable. De-duped, string-only.
    const keyList = (arr) => {
        const out = []
        if (Array.isArray(arr)) {
            for (const k of arr) if (typeof k === "string" && k && !out.includes(k)) out.push(k)
        }
        return out
    }
    // A persistent, free-form numeric stat block. Intentionally open (the economy,
    // doc §7, defines what accrues here) — kept as plain number fields for now.
    const numMap = (obj) => {
        const out = {}
        if (obj && typeof obj === "object") {
            for (const [k, v] of Object.entries(obj)) if (typeof v === "number" && isFinite(v)) out[k] = v
        }
        return out
    }
    const num = (v, d = 0) => (typeof v === "number" && isFinite(v) ? v : d)

    return {
        id,
        name: typeof o.name === "string" && o.name.trim() ? o.name : "Unnamed Hero",
        // IMMUTABLE identity — set at mint, never reassigned by the game.
        class: typeof o.class === "string" ? o.class : null,

        // --- persistent progression (inert until the economy phase, doc §7) ---
        level: num(o.level, 1),
        xp: num(o.xp, 0),
        learnedAbilities: keyList(o.learnedAbilities),
        learnedTraits: keyList(o.learnedTraits),
        stats: numMap(o.stats),
        bankedSkillPoints: num(o.bankedSkillPoints, 0),
        bankedShards: num(o.bankedShards, 0),
        // Current attuned affinity (single slot, as today) — a registry key or null.
        affinity: typeof o.affinity === "string" ? o.affinity : null,

        // --- flavor + record ---
        backstory: normalizeBackstory(o.backstory),
        history: (Array.isArray(o.history) ? o.history : [])
            .map(normalizeRunRecord)
            .filter(Boolean),

        // --- lifecycle ---
        status: CHARACTER_STATUS.includes(o.status) ? o.status : "living",
        createdAt: typeof o.createdAt === "string" ? o.createdAt : null,
        lastRunAt: typeof o.lastRunAt === "string" ? o.lastRunAt : null,
    }
}
