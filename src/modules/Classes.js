import ranger from "./classes/profiles/ranger.js"
import warrior from "./classes/profiles/warrior.js"
import wizard from "./classes/profiles/wizard.js"

// Hero class registry — profile data objects rather than subclasses. Keys are the
// player-facing class names (the class picker reads Object.keys; dungeon.hero
// stores the chosen key as a string). Dungeon.placePlayer instantiates a plain
// BaseHero and calls .applyProfile(classes[name]) to specialize it.
//
// Three, not v3's six. Warrior / Ranger / Wizard were chosen for play-feel
// contrast — pure melee, pure ranged, pure caster — rather than for which had the
// most content already written. Cleric, Dwarf and Shaman are cut (scope doc
// section 10). The Ranger was called the Elf until the class picker was built.
const classes = {
    Ranger: ranger,
    Warrior: warrior,
    Wizard: wizard,
}

export default classes
