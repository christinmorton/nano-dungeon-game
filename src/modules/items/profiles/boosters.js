// Permanent boosters (§13d) — durable stat/HP/slot ups. SYSTEM PENDING
// (permanent stat-up, ties to the persistent account). Data only; #47.
export default {
    vitalityShard: { itemClass: 'Booster', name: "Vitality Shard", description: "A warm sliver of pure life. Swallow it and you are, for good, a little harder to kill.", tile: 670, art: { sheet: "minerals", file: "Icon8.png" }, droppable: false, effect: "permanent +max HP (or +CON)" },
    soulEmber: { itemClass: 'Booster', name: "Soul Ember", description: "A coal that never cools. It changes the one who carries it out.", tile: 670, art: { sheet: "minerals", file: "Icon9.png" }, droppable: false, effect: "permanent +1 to a chosen base stat" },
    codexFragment: { itemClass: 'Booster', name: "Codex Fragment", description: "A page of something larger. The mind that holds it holds a little more.", tile: 670, art: { sheet: "32rogues-items", name: "page" }, droppable: false, effect: "permanent +1 ability slot / skill point" },
}
