// Guild Charter — the rare roster-expansion relic (documents/v3_hero_roster_and_account_progression.md §5).
// Redeeming it PERMANENTLY grants the account one more living-hero slot in the
// Guild Hall. A META effect (account-level, not the in-run hero) — the sibling of
// the Lightbound Reliquary (which wards a hero's memory). Rare/vault pool, not the
// uniform drop table (findability rides on the parked loot system; grantable for
// testing meanwhile). The `effect` is read by Consumable.equip's Relic branch.
//
// LORE — Every hall has its charter: the writ that says how many names its walls
// may hold. Most are sealed once and never reopened. This one was left unsigned —
// a single blank line beneath the last hero's name, waiting. Add a name, and the
// hall makes room, the way a hall always has: quietly, and for good.

export default {
    itemClass: 'Relic',
    name: "Guild Charter",
    description: "A sealed writ of the Hall with one blank line left. Redeem it to make permanent room for one more hero on your living roster.",
    tile: 670,
    // Art TODO — reuses the tome/book tile as a placeholder until a dedicated
    // charter/scroll icon exists (verify-tiles rule before wiring a real frame).
    droppable: false,          // rare/vault pool, not the uniform drop table
    effect: 'grantRosterSlot', // Consumable.equip Relic branch → account.redeemRosterExpansion
    consumedOnUse: true,       // spent the moment it is redeemed
}
