// Core utility / navigation items (§7, §12a oil, §12b maps, §12d QoL). SYSTEM
// PENDING per item (map reveal + minimap UI; lantern fuel; lockpick→door/chest;
// rope→pit; field rest; inventory cap; instant-MP). Data only; #47.
const R = (name) => ({ sheet: "32rogues-items", name })

export default {
    // §12b maps
    dungeonMap: { itemClass: 'Consumable', name: "Dungeon Map", description: "A hurried chart of this floor, dropped by someone who got further than you have. Reveals the layout.", tile: 768, art: R("page"), droppable: false, effect: "reveal current floor's fog" },
    scrollOfMapping: { itemClass: 'Consumable', name: "Scroll of Mapping", description: "Read to wash the floor around you onto the page in spreading ink.", tile: 768, art: R("scroll"), droppable: false, effect: "reveal current floor" },
    surveyorsCompass: { itemClass: 'Accessory', name: "Surveyor's Compass", description: "It doesn't point north. It points down — to the stairs, and to the thing this floor is hiding.", tile: 670, art: R("discPendant"), slot: 'accessory', droppable: false, effect: "marks stairs (and the run's relic) on the map" },

    // §12d quality-of-life
    lockpick: { itemClass: 'Consumable', name: "Lockpick", description: "Open a locked door or chest without the key — if your hands are steady. May break.", tile: 670, art: R("metalKey"), droppable: false, effect: "open a locked door/chest" },
    ropeAndGrapple: { itemClass: 'Consumable', name: "Rope & Grapple", description: "Cross a pit, climb a drop, or haul a stuck ally free.", tile: 670, droppable: false, effect: "cross a pit (counter to Pit Trap)" },
    bedroll: { itemClass: 'Consumable', name: "Bedroll", description: "A few hours' rest in a safe corner. Restores health between fights — once.", tile: 670, droppable: false, effect: "field rest (one-shot heal)" },
    satchel: { itemClass: 'Accessory', name: "Traveler's Satchel", description: "An extra bag. You can carry more of what you find.", tile: 670, slot: 'accessory', droppable: false, effect: "+inventory capacity" },

    // §12a lantern fuel
    lanternOil: { itemClass: 'Consumable', name: "Lantern Oil", description: "A flask to refill a lantern. (In a pinch, throw it — see Oil Flask.)", tile: 670, art: R("brownVial"), droppable: false, effect: "refuel lantern" },

    // §7 extras
    surgeDraught: { itemClass: 'Consumable', name: "Surge Draught", description: "A harder hit of the Quickening. +4 movement this turn.", tile: 670, art: R("greenPotion"), droppable: false, effect: "+4 movement this turn" },
    wayfarerBread: { itemClass: 'Consumable', name: "Wayfarer's Bread", description: "Plain rations. Restores a little health over a few turns when out of danger.", tile: 670, art: R("bread"), droppable: false, effect: "regen-over-time (out of combat)" },
}
