import cleric from "./classes/profiles/cleric.js"
import dwarf from "./classes/profiles/dwarf.js"
import elf from "./classes/profiles/elf.js"
import shaman from "./classes/profiles/shaman.js"
import warrior from "./classes/profiles/warrior.js"
import wizard from "./classes/profiles/wizard.js"

// Hero class registry — now profile data objects rather than subclasses.
// Keys are the player-facing class names (Intro.js reads Object.keys to
// build the picker; dungeon.hero stores the chosen key as a string).
// Dungeon.placePlayer instantiates a plain BaseHero and calls
// .applyProfile(profiles[name]) to specialize it.
const classes = {
    Cleric: cleric,
    Dwarf: dwarf,
    Elf: elf,
    Shaman: shaman,
    Warrior: warrior,
    Wizard: wizard
}

export default classes
