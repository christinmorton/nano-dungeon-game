// Ember of Return — the rare revive relic (documents/v3_hero_roster_and_account_progression.md §8).
// Using it banks a REVIVE TOKEN on the account; at the Guild Hall you spend a token
// to call one FALLEN hero back to the living roster (slot permitting). Decoupled
// find-from-use because reviving needs a TARGET (which fallen hero) that only the
// Hall UI can pick. A META effect (account-level), sibling of the Guild Charter
// (roster +1) and the Lightbound Reliquary (preserves a hero's learnings on death).
// Rare/vault pool, not the uniform drop table (loot placement rides the parked loot
// system; grantable for testing meanwhile). `effect` is read by Consumable.equip.
//
// LORE — The Void unmakes; the Light, sometimes, remembers. An Ember is a mote of
// that remembering — a single caught coal of dawn, kept against the day a name goes
// dark. It cannot be spent in the deep, where the dark is thickest; it must be
// carried home to the Hall and kindled there, over the place a hero used to stand.
// One coal, one name. Then it is ash, and the Light owes you nothing more.

export default {
    itemClass: 'Relic',
    name: "Ember of Return",
    description: "A caught coal of dawn. Carry it to the Hall and kindle it to call one fallen hero back from the dark — once, then it is ash.",
    tile: 670,
    // Art TODO — placeholder tile until a dedicated ember icon exists (verify-tiles
    // rule before wiring a real frame).
    droppable: false,           // rare/vault pool, not the uniform drop table
    effect: 'grantReviveToken', // Consumable.equip Relic branch → account.grantReviveToken
    consumedOnUse: true,        // spent the moment it is kindled into a token
}
