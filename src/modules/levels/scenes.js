// Scenes (design doc §14.5) — the DATA half of furnishing. A scene names what a
// room IS ("rest camp", later "vault"/"shrine"/"barracks") as an ordered list
// of decor placements. Each placement is:
//   role        — an ABSTRACT decor slot ("shelter", "foliage"), resolved to a
//                 concrete Prop class by the recipe's prop palette (furnish.js).
//                 The same scene furnishes differently per realm because the
//                 palette differs — the whole scene x theme point of §14.5.
//   arrangement — which arrangement primitive places it (arrangements.js).
//   count       — how many to place (arrangement-dependent; omit for the default).
//
// Scenes are keyed by room.kind so the existing kind system keeps driving the
// functional feature (the Tent/Shrine/chest placed in spawnFromTable) and the
// furnisher only ADDS dressing around it — additive, no kind refactor yet.
//
// Slice 1 ships one scene: the rest room becomes a real camp. The functional
// Campfire + Tent are still placed by spawnFromTable's rest table; the furnisher
// dresses the room out with hide tents flanking the fire and trees scattered
// around, so it reads as a wilderness campsite rather than a fire in a box.

export const SCENES = {
    rest: [
        { role: "shelter", arrangement: "flanking", count: 2 },
        { role: "foliage", arrangement: "scatter", count: 3 },
    ],
    // Treasure rooms get a piece of statuary — the first scene to place a
    // MULTI-TILE prop (the statue is 2x3). Scattered rather than centred so it
    // dresses the room without sitting on the chest the treasure table drops.
    // A room too small or too full for a 2x3 simply doesn't get one: the
    // furnisher vets every covered tile and rejects placements that would seal
    // the room, so this degrades to "no statue" rather than to a blocked vault.
    treasure: [
        { role: "monument", arrangement: "scatter", count: 1 },
    ],
}
