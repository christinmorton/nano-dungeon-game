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
    { key: "secret", label: "Secret", kind: "secret", rate: 0.5, hint: "sealed behind a hidden passage" },
    // The CAMP — a shopkeeper and a campfire in one safe room (scope doc §10.11).
    // Rate 1.0 is deliberate and is the one rule that should stay pinned: the
    // guaranteed health and cure potions are only a guarantee if every floor has
    // somewhere to buy them.
    //
    // This replaces the separate `shop` and `rest` rules, which BOTH sat here at
    // rate 1.0 since the port and were both filled by nothing — two empty rooms
    // on every floor. Merging them also hands a room back to the floor's combat
    // budget, which matters more at five floors than it did at v3's depth.
    { key: "camp", label: "Camp", kind: "camp", rate: 1.0, hint: "a shopkeeper and a campfire — trade, rest, and be safe" },
]

// REMOVED 2026-09-22 (scope doc §10.11): `shrine`, `duelist`, `pact`, `essence`,
// `grove` and the two `settlement` rules. Every one of them stamped a kind that
// NOTHING in v5 reads — spawnFromTable has no branch for any of them, and the
// systems they belong to (shrines, affinity pacts, essence fonts, settlements)
// are cut in scope doc §6. They were not harmless: each rule claims a room from
// the unclaimed pool before later rules get to look at it, and five of the seven
// ran at rate 1.0 or near it. On a floor of a dozen rooms they were quietly
// eating the room budget every single floor to produce ordinary combat rooms
// with a misleading `kind` on them.
//
// `settlementPayload` went with them — it wrote `room.settlement`, which nothing
// in v5 has ever read.
//
// The `fortressSelector` export below is kept: it is referenced by BSPLevel's
// `selectors` argument, and a selector nothing requests is inert rather than
// wrong. Deleting it would be a second edit in a second file for no gain.

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
