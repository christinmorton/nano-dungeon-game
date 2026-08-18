// Crafting reagents (§13b) — passive inputs for the (pending) alchemy/crafting
// system. They double as loot VARIETY now, so they stay droppable. No active
// use. See known-issues #47.
const M = (file) => ({ sheet: "minerals", file })

export default {
    bloodroot: { itemClass: 'Reagent', name: "Bloodroot", description: "A red root; the base of any healing brew.", tile: 670, art: M("Icon3.png"), use: "alchemy → mending draughts" },
    nightcapSpores: { itemClass: 'Reagent', name: "Nightcap Spores", description: "Dried toadstool dust. Don't inhale.", tile: 670, art: M("Icon4.png"), use: "alchemy → poison / gas" },
    emberSalt: { itemClass: 'Reagent', name: "Ember Salt", description: "Crystals that spark when struck.", tile: 670, art: M("Icon5.png"), use: "alchemy → fire flasks" },
    hollowResidue: { itemClass: 'Reagent', name: "Hollow Residue", description: "Scraped from a cleansed rift. Unstable, valuable, wrong.", tile: 670, art: M("Icon6.png"), use: "alchemy / runes → void effects" },
    beastFang: { itemClass: 'Reagent', name: "Beast Fang", description: "A fang off something that nearly ate you. Dropped by beasts.", tile: 670, art: M("Icon7.png"), use: "crafting → weapons / charms" },
}
