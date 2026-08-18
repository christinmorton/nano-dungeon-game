// Lightbound Reliquary — the single sanctioned exception to extraction-gated
// persistence (see documents/v3_ability_progression_system.md §7.2).
//
// SYSTEM PENDING (account persistence / skillbook not built). Data only — the
// `effect` field is inert until the persistence system reads it, exactly like
// the legendary `special` affixes and the tome `teaches` field. See #47.
//
// LORE — Where most relics ward the body, the Reliquary wards the *memory*. The
// Light preserves; the Void unmakes — and what the Void unmakes first, the
// scholars say, is not flesh but the *knowing*: a fallen delver's hard-won craft
// scattered back into the dark as if it had never been learned. The Reliquary is
// a small consecrated vessel, sealed with a mote of caught dawn, that a delver
// carries against that erasure. Should its bearer fall, the Light flares once and
// catches a fragment of what they had learned before the unmaking can take it —
// then gutters out, spent. They are not made; they are *found*, already old, in
// places the Void has not yet reached. A delver carries one and prays never to
// learn what it does.
//
// Mechanic (when the system ships): a one-off. If the bearer dies, their LEARNED
// abilities + traits from this run commit to the account book anyway — the one
// thing that survives a death. Consumed on trigger.

export default {
    itemClass: 'Relic',
    name: "Lightbound Reliquary",
    description: "A consecrated soul-vessel. If you fall, it keeps a fragment of what you learned from the Void's unmaking — once, then it is spent.",
    tile: 670,
    // Art TODO — reuses the tome/book tile as a placeholder until a dedicated
    // reliquary icon exists. Omitting `art` falls back to the tilesheet render.
    droppable: false,        // special vessel — wants a rare/vault pool, not the uniform drop table
    effect: 'preserveLearnsOnDeath',
    savesScope: 'learned',   // commits this run's learned abilities + traits on death
    consumedOnTrigger: true, // one-off: spent the moment it fires
}
