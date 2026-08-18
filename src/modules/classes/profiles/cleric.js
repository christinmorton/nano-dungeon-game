import Heal from "../abilities/Heal.js"
import Smite from "../abilities/Smite.js"
import Bless from "../abilities/Bless.js"
import TurnUndead from "../abilities/TurnUndead.js"
import ClericRegen from "../abilities/ClericRegen.js"
import Lustration from "../abilities/Lustration.js"
import ZenithsVerdict from "../abilities/ZenithsVerdict.js"

// HP blends CON and Magic — divine vitality. ClericRegen is the Devotion
// passive: heal +1 HP each refresh while under maxHP/4. Lustration (S) is the
// cure — strips negative statuses (the de-WoW rename of Cleanse). (Siphon, the
// drain testbed that briefly sat here, is unslotted again — it's Void content.)

export default {
    name: "Cleric",
    tile: 24,
    art: { sheet: "heroes", file: "classes/cleric_south.png" },
    stats: { STR: 10, DEX: 10, CON: 15, SPD: 10, INT: 10, Magic: 10 },
    hpFormula: (s) => 285 + (s.CON + s.Magic) * 12,
    startingItems: ['hammer'],
    abilities: [Heal, Smite, Bless, TurnUndead, Lustration],
    // Lean-start (§14): Smite is the combat opener; Heal/support reachable via draft.
    starterAbility: Smite,
    // Role pool for the milestone draft (§14 B5/B6) — light/holy picks + the displaced kit.
    draftPool: ['Heal', 'Bless', 'TurnUndead', 'Lustration', 'HolyNova', 'SearingLight', 'HallowedGround', 'Dispel', 'BlindingFlash', 'Sanctuary', 'AngelicAegis'],
    ultimate: ZenithsVerdict,
    passives: [ClericRegen]
}
