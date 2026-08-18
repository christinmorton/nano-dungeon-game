// Utility flasks / draughts (§10b) — drink for a TIMED BUFF (or a cure).
// SYSTEM SHIPPED 2026-06-08: items/DraughtItem.js reads profile.buff (a status
// tag whose own hooks own the duration + auto-expiry) or profile.cure (remove
// the listed statuses). Stoneskin maps to Bulwark (working +block) rather than
// Shield (still a stub). See known-issues #47 item 8.
const R = (name) => ({ sheet: "32rogues-items", name })

export default {
    mightDraught: { itemClass: 'Draught', name: "Draught of Might", description: "A hot, iron-tasting tonic. Your blows land heavier for a while.", tile: 670, art: R("orangePotion"), droppable: true, buff: "Might" },
    stoneskinDraught: { itemClass: 'Draught', name: "Stoneskin Draught", description: "Your skin sets like warm clay — it'll turn a few blows before it cracks.", tile: 670, art: R("brownVial"), droppable: true, buff: "Bulwark" },
    swiftnessDraught: { itemClass: 'Draught', name: "Swiftness Draught", description: "The room slows around you. Move while the world catches up.", tile: 670, art: R("bluePotion"), droppable: true, buff: "Haste" },
    shadowDraught: { itemClass: 'Draught', name: "Draught of Shadows", description: "You go dim at the edges; eyes slide off you. Slip away while they look elsewhere.", tile: 670, art: R("blackPotion"), droppable: true, buff: "Invisible" },
    antidote: { itemClass: 'Draught', name: "Antidote", description: "A bitter purge that flushes poison and rot from the blood.", tile: 670, art: R("brightGreenPotion"), droppable: true, cure: ["Poison", "Acid", "Blight"] },
}
