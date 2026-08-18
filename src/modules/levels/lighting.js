// Lighting — how a floor is lit, and (under open sky) how that changes as the
// run goes on.
//
// WHY THIS EXISTS: one sight radius could not mean two things. Underground,
// walls chop the sight circle into corridor shapes, so radius 5 reads as
// TORCHLIGHT — the limit feels like the dark, which is exactly the dungeon
// feel we want. Outdoors nothing blocks it, so that same circle sat in the
// middle of a sunlit glade and read as darkness at noon.
//
// A theme names its SKY, not its brightness:
//   torchlit — no sky. Static, and the values ARE the historical fog constants,
//              so every interior behaves exactly as it always has.
//   daylight — under open sky. Brightness comes from the day/night cycle below.
//
// Daylight is NOT "reveal everything". The open realms are bounded by autotiled
// barriers (thicket, deep water, brick) that hasLineOfSight already respects, so
// a wide radius shows you across the clearing and stops at the treeline.
// Undiscovered ground stays fully black at every hour — exploration is
// unaffected by the time of day.
//
// This is a LEAF module on purpose: no imports. It is pure arithmetic over
// (theme, round), so the fog renderer, the enemy perception code and a headless
// test can all resolve the same ambient without anyone importing a singleton.

// ---- the cycle ------------------------------------------------------------

// Rounds in one full dawn→night→dawn. tm.tickCount is a run-long round counter
// incremented once per resolved round (World.update → tm.refresh), and it does
// NOT reset per floor — so time keeps running while you're underground and you
// can descend at noon and climb out at dusk.
//
// TUNING KNOB, and it was wrong the first time. At 480 the run starts at midday
// (t=0.22), dusk does not begin until round 192 and night not until 269 — far
// longer than a floor takes, so a play session never left flat daylight, which
// draws no tint at all. The cycle was running perfectly and was invisible.
//
// 160 puts dusk at round ~64 and night at ~90: roughly one full day per floor or
// two. That is much faster than real time and deliberately so — this is a
// legibility choice, not a simulation one. The player has to be able to SEE the
// mechanic that is taking their sight away.
export const CYCLE_ROUNDS = 160

// Keyframes around the clock, `at` in [0,1). Values are INTERPOLATED between
// adjacent keys (wrapping night→dawn), so dusk actually falls rather than
// snapping. Sorted by `at`; keep it that way.
//
//   radius     — hero sight, in tiles.
//   alphaSeen  — dim over explored-but-not-visible ground. You remember open
//                country better by day than by night.
//   tint/tintA — a wash drawn over the LIT area. This is what makes night read
//                as night rather than as a smaller circle of fog.
//   lightBonus — multiplier on an equipped light source. THE POINT OF THE
//                CYCLE: a torch is worthless at noon and essential at midnight,
//                so light sources stop being dead weight outdoors and start
//                being the thing you ration for the dark hours.
//   enemySight — multiplier on enemy perception range. Night dims THEM too, so
//                darkness is a stealth window rather than a flat penalty.
export const DAY_PHASES = [
    { key: "dawn",  label: "Dawn",  at: 0.00, radius: 9,  alphaSeen: 0.45, tint: 0x2a1e3a, tintAlpha: 0.16, lightBonus: 0.5, enemySight: 0.90 },
    { key: "day",   label: "Day",   at: 0.22, radius: 14, alphaSeen: 0.35, tint: 0x000000, tintAlpha: 0.00, lightBonus: 0.0, enemySight: 1.00 },
    { key: "dusk",  label: "Dusk",  at: 0.62, radius: 9,  alphaSeen: 0.45, tint: 0x3a2030, tintAlpha: 0.18, lightBonus: 0.5, enemySight: 0.90 },
    { key: "night", label: "Night", at: 0.78, radius: 5,  alphaSeen: 0.60, tint: 0x060a20, tintAlpha: 0.45, lightBonus: 1.0, enemySight: 0.65 },
]

// A run starts at full day, so the first outdoor floor is bright and the player
// meets the mechanic at its friendliest. DERIVED from the keyframe rather than
// written as a number, so retuning the table can't silently start runs at dusk.
const CYCLE_START = DAY_PHASES.find(p => p.key === "day").at

// What the player is told when the hour turns. Only fires on sky floors.
export const PHASE_MESSAGES = {
    dawn: "Light returns to the horizon.",
    day: "The sun climbs. You can see for miles.",
    dusk: "The light is going.",
    night: "Night falls. The dark closes in.",
}

// ---- sky types ------------------------------------------------------------

export const LIGHTING = {
    // No sky: static, and these are the historical fog constants.
    torchlit: {
        label: "Torchlit",
        sky: false,
        radius: 5,
        alphaSeen: 0.55,
        tint: 0x000000,
        tintAlpha: 0,
        lightBonus: 1,
        enemySight: 1,
        // Underground, the walls ARE the puzzle — revealing them would hand the
        // player the maze. Unexplored stays solid black.
        revealTerrain: false,
    },
    // Under open sky: every value above comes from the cycle instead.
    //
    // revealTerrain: outdoors the "walls" are the LANDSCAPE — water, thicket,
    // cliff. You can see a lake across a valley without having walked to it, and
    // blacking it out read as a bug rather than as fog. Barrier tiles are drawn
    // at the memory dim from the start; open ground you haven't visited stays
    // dark, so exploring still reveals where you can GO, just not what the land
    // looks like. The dim is the cycle's alphaSeen, so the silhouette is crisp at
    // noon and murky at midnight for free.
    daylight: { label: "Daylight", sky: true, revealTerrain: true },
}

export const DEFAULT_LIGHTING = "torchlit"
export const LIGHTING_KEYS = Object.keys(LIGHTING)

// A floor may pin its hour instead of following the clock — an author's dungeon
// that is always night, or always noon. "cycle" is the default.
export const TIME_OF_DAY_KEYS = ["cycle", ...DAY_PHASES.map(p => p.key)]
export const TIME_OF_DAY_LABELS = {
    cycle: "Cycle (day → night)",
    ...Object.fromEntries(DAY_PHASES.map(p => [p.key, `Always ${p.label.toLowerCase()}`])),
}

// ---- resolution -----------------------------------------------------------

const lerp = (a, b, f) => a + (b - a) * f

// Blend two packed 0xRRGGBB colours channel-wise. Lerping the packed integers
// directly would bleed each channel into the next.
function lerpColor(a, b, f) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
    return (Math.round(lerp(ar, br, f)) << 16)
        | (Math.round(lerp(ag, bg, f)) << 8)
        | Math.round(lerp(ab, bb, f))
}

export function lightingPreset(key) {
    return LIGHTING[key] || LIGHTING[DEFAULT_LIGHTING]
}

// Position in the cycle for a round, in [0,1).
export function cycleTime(round) {
    const t = ((round || 0) / CYCLE_ROUNDS) + CYCLE_START
    return t - Math.floor(t)
}

// The blended phase at a point in the cycle. `key` names the phase you are IN
// (the keyframe you last passed), which is what the log message and any UI want
// — the values themselves are mid-blend.
export function phaseAt(t) {
    const n = DAY_PHASES.length
    let i = 0
    // EPSILON MATTERS HERE. Wrapping the clock lands a hair BELOW the keyframe
    // it should land on (480/480 + 0.22 - 1 === 0.21999999999999997), which
    // without slack reports the previous phase for one round — and since the log
    // fires on phase change, that means a spurious "dawn" line immediately
    // followed by "day", once per cycle, forever.
    for (let k = 0; k < n; k++) if (t >= DAY_PHASES[k].at - 1e-9) i = k
    const from = DAY_PHASES[i]
    const to = DAY_PHASES[(i + 1) % n]
    // The final span wraps past 1.0 back to the first keyframe.
    const span = (to.at > from.at ? to.at : to.at + 1) - from.at
    // Clamped because the epsilon above can select a keyframe a hair before t
    // reaches it, which would otherwise make f marginally negative and push
    // every interpolated value a hair outside its keyframe range (a negative
    // alpha is not a colour Phaser wants).
    const f = Math.min(1, Math.max(0, span > 0 ? (t - from.at) / span : 0))
    return {
        key: from.key,
        label: from.label,
        radius: Math.max(1, Math.round(lerp(from.radius, to.radius, f))),
        alphaSeen: lerp(from.alphaSeen, to.alphaSeen, f),
        tint: lerpColor(from.tint, to.tint, f),
        tintAlpha: lerp(from.tintAlpha, to.tintAlpha, f),
        lightBonus: lerp(from.lightBonus, to.lightBonus, f),
        enemySight: lerp(from.enemySight, to.enemySight, f),
    }
}

// THE ENTRY POINT. Resolve how a floor is lit right now.
//
//   theme — the floor's normalized theme (reads .lighting and .timeOfDay).
//   round — tm.tickCount, the run-long round counter.
//
// A floor with no sky ignores `round` entirely and returns its static preset, so
// interiors are unaffected by the clock and by the timeOfDay override.
export function resolveAmbient(theme, round) {
    const preset = lightingPreset(theme && theme.lighting)
    if (!preset.sky) return { ...preset, cycles: false }

    // Sky-wide properties (what the floor IS) ride along with the hourly ones
    // (what the floor is like RIGHT NOW), so the renderer reads one object.
    const sky = { revealTerrain: !!preset.revealTerrain }

    const pinned = theme && theme.timeOfDay
    if (pinned && pinned !== "cycle") {
        const key = DAY_PHASES.find(p => p.key === pinned)
        // A pinned hour takes that keyframe verbatim — no blending, because
        // there is no time passing to blend across.
        if (key) return { ...key, ...sky, cycles: false, label: key.label }
    }
    return { ...phaseAt(cycleTime(round)), ...sky, cycles: true }
}
