// Room kinds — the DATA half of "which special rooms a floor gets".
//
// This used to be ~110 lines of copy-pasted blocks inside BSPLevel, one per
// kind, each against a module constant nobody outside that file could see. Two
// consequences: every random floor of every dungeon rolled the SAME
// distribution, and AUTHORED floors got no specials at all — AuthoredLevel has
// no equivalent pass, so a hand-drawn dungeon had exactly the rooms you drew and
// nothing else. Both generators now share this table, and the designer can
// author over it per dungeon.
//
// ORDER IS SIGNIFICANT. Each rule claims a room from the pool of rooms that
// still have no kind, so a rule listed earlier gets first pick and later rules
// see a smaller pool. The order below is the historical one, kept verbatim so an
// unauthored floor generates exactly what it always did.
//
// Every rule rolls independently and, by default, claims at most ONE room per
// floor. `count` in an authored mix raises that cap; a `count` of 0 turns the
// kind off entirely.

// Themed single-species rooms. The rule writes one of these as the room kind
// rather than its own key — spawnTables.json keys off these names.
export const SPECIFIC_ENEMY_KINDS = ["bats-only", "skeletons-only", "orcs-only", "trolls-only"]

// How many rooms must still be unclaimed for a rule to fire. Stops a small floor
// from turning entirely into special rooms with nowhere to fight.
const DEFAULT_MIN_REMAINING = 3

// A settlement room is a themed enemy group scaled by a "form" (see
// documents/v3_enemy_settlements.md). Both settlement rules write kind
// "settlement" and differ only in which forms they roll and how big a room they
// need, so they are two rules over one kind rather than two kinds.
const settlementPayload = (forms) => (room, rng) => {
    room.settlement = { species: "orc", form: rng.pick(forms), faction: "orc" }
    room.floorTheme = "outdoor"
}

export const ROOM_KIND_RULES = [
    {
        key: "treasure", label: "Treasure", kind: "treasure", rate: 0.75,
        hint: "a chest room",
    },
    {
        // Writes one of SPECIFIC_ENEMY_KINDS, not its own key.
        key: "specific-enemy", label: "Themed enemies", rate: 0.55,
        kindFrom: SPECIFIC_ENEMY_KINDS,
        hint: "a room of one species (bats / skeletons / orcs / trolls)",
    },
    { key: "shrine", label: "Shrine", kind: "shrine", rate: 0.5, hint: "a buff shrine" },
    { key: "duelist", label: "Duelist", kind: "duelist", rate: 0.4, hint: "a single champion" },
    { key: "secret", label: "Secret", kind: "secret", rate: 0.5, hint: "sealed behind a hidden passage" },
    // The four rates below were pinned at 1.0 while their features were verified
    // end-to-end, not because a shop/rest/pact/font on every floor is the right
    // game. They are now authored defaults rather than buried constants, which is
    // the point — tune them per dungeon instead of editing this file.
    { key: "shop", label: "Shop", kind: "shop", rate: 1.0, hint: "a shopkeeper" },
    { key: "rest", label: "Rest", kind: "rest", rate: 1.0, hint: "a safe camp — heal and recover" },
    { key: "pact", label: "Pact", kind: "pact", rate: 1.0, hint: "an advanced-affinity pact offer" },
    { key: "essence", label: "Essence", kind: "essence", rate: 1.0, hint: "attune a basic affinity at a font" },
    { key: "grove", label: "Grove", kind: "grove", rate: 0.35, hint: "a mythical beast bestows an empowered affinity" },
    {
        // Needs a genuinely large room and takes the BIGGEST eligible one, not a
        // random pick — hence a selector rather than a size filter.
        key: "settlement-fortress", label: "Fortress", kind: "settlement", rate: 1.0,
        select: "fortress",
        apply: settlementPayload(["fortress", "outpost"]),
        hint: "a warlord fortress or leaderless outpost",
    },
    {
        key: "settlement-camp", label: "Camp / village", kind: "settlement", rate: 1.0,
        minRoom: { w: 9, h: 8 },
        // A camp only needs a room that fits it, so unlike the fortress it has no
        // minimum-remaining gate — it was written that way and stays that way.
        minRemaining: 0,
        apply: settlementPayload(["encampment", "village"]),
        hint: "a hostile encampment or a neutral village",
    },
]

const RULES_BY_KEY = Object.fromEntries(ROOM_KIND_RULES.map(r => [r.key, r]))

// The "fortress" selector: the LARGEST room that clears the fortress minimums
// and still leaves the floor room to breathe (no bigger than a quarter of it).
// A factory rather than a constant because the quarter is measured against the
// floor, and the two generators describe their floor differently — BSP by its
// root area, an authored floor by its grid.
export function fortressSelector(floorW, floorH) {
    const quarter = (floorW * floorH) / 4
    const MIN_W = 14, MIN_H = 11, MIN_AREA = 176
    return (rooms) => {
        const eligible = rooms.filter(r =>
            r.w >= MIN_W && r.h >= MIN_H && r.w * r.h >= MIN_AREA && r.w * r.h <= quarter)
        if (eligible.length === 0) return null
        return eligible.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a))
    }
}

// The authored mix as the designer stores it: { [ruleKey]: { count, chance } }.
// Absent entries fall back to the rule's own defaults, so a partial mix is fine
// and a missing mix reproduces the historical distribution exactly.
export function resolveRule(rule, mix) {
    const authored = (mix && typeof mix === "object" && mix[rule.key]) || null
    const count = (authored && Number.isFinite(authored.count)) ? Math.max(0, Math.floor(authored.count)) : 1
    const chance = (authored && Number.isFinite(authored.chance)) ? Math.min(1, Math.max(0, authored.chance)) : rule.rate
    return { count, chance }
}

// The mix a designer starts from — every rule at its built-in defaults.
export function defaultRoomKindMix() {
    const out = {}
    for (const rule of ROOM_KIND_RULES) out[rule.key] = { count: 1, chance: rule.rate }
    return out
}

// Stamp special kinds onto `rooms`.
//
//   rooms      — every room on the floor. Rooms that already carry a kind (a
//                start/end room, or one the designer named) are never touched;
//                only the unclaimed ones are eligible.
//   isEligible — which rooms may be claimed. Defaults to "has no kind yet".
//                AuthoredLevel passes its own test because its rooms are all
//                already 'combat' by the time this runs.
//   mix        — authored overrides, or null/undefined for the defaults.
//   selectors  — named room pickers a rule can ask for by `select` (currently
//                just "fortress", which BSPLevel sizes against its root area).
//
// Returns the number of rooms claimed, which callers log.
export function assignRoomKinds({ rooms, rng, mix = null, isEligible = null, selectors = {} }) {
    const eligible = isEligible || ((room) => !room.kind)
    const pool = () => rooms.filter(eligible)
    let claimed = 0

    for (const rule of ROOM_KIND_RULES) {
        const { count, chance } = resolveRule(rule, mix)
        for (let n = 0; n < count; n++) {
            // Re-filtered every placement: a rule asking for two rooms must not
            // hand out the same one twice, and each claim shrinks the pool the
            // minimum-remaining gate measures.
            let candidates = pool()
            const minRemaining = Number.isFinite(rule.minRemaining) ? rule.minRemaining : DEFAULT_MIN_REMAINING
            if (candidates.length < minRemaining) break
            if (rule.minRoom) {
                candidates = candidates.filter(r => r.w >= rule.minRoom.w && r.h >= rule.minRoom.h)
            }
            if (!candidates.length) break
            // ORDER OF RNG CALLS IS LOAD-BEARING. A locked seed must reproduce
            // the layout it produced before this table existed, so every draw
            // happens in the same sequence the hand-written blocks used: gate
            // (no draw), then the chance roll, then the sub-kind, then the room.
            // Rolling these in any other order desyncs every pinned seed.
            if (!rng.chance(chance)) continue

            // Sub-kind before the room — the specific-enemy block picked its
            // species first and the room second.
            const kind = rule.kindFrom ? rng.pick(rule.kindFrom) : rule.kind

            // A rule with a named selector cannot fall back to a random pick: the
            // selector IS the rule's size contract (a fortress in a 5x5 room is
            // not a fortress). Missing selector means the rule can't fire here.
            let room
            if (rule.select) {
                const select = selectors[rule.select]
                room = select ? select(candidates) : null
            } else {
                room = rng.pick(candidates)
            }
            if (!room) continue

            room.kind = kind
            if (rule.apply) rule.apply(room, rng)
            claimed++
        }
    }
    return claimed
}

// Normalize a mix off an authored skeleton / recipe. Unknown keys are dropped so
// a stale export can't smuggle in a rule that no longer exists.
export function normalizeRoomKindMix(raw) {
    if (!raw || typeof raw !== "object") return null
    const out = {}
    for (const [key, entry] of Object.entries(raw)) {
        if (!RULES_BY_KEY[key] || !entry || typeof entry !== "object") continue
        const rec = {}
        if (Number.isFinite(entry.count)) rec.count = Math.max(0, Math.floor(entry.count))
        if (Number.isFinite(entry.chance)) rec.chance = Math.min(1, Math.max(0, entry.chance))
        if (Object.keys(rec).length) out[key] = rec
    }
    return Object.keys(out).length ? out : null
}
