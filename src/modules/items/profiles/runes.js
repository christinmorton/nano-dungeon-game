// Runestones (§13a) — apply to gear to grant an element/effect. SYSTEM PENDING
// (rune-apply / enchant; answers the "how does a weapon get a damageFlavor"
// question in v3_magic_and_elements.md). Data only; see known-issues #47.
const M = (file) => ({ sheet: "minerals", file })

export default {
    emberRune: { itemClass: 'Rune', name: "Ember Rune", description: "Etch it into an edge and the edge wakes burning.", tile: 670, art: M("Icon10.png"), droppable: false, applyTo: "weapon", grants: { damageFlavor: "fire" } },
    frostRune: { itemClass: 'Rune', name: "Frost Rune", description: "A cold sigil; the blade bites and the wound won't warm.", tile: 670, art: M("Icon11.png"), droppable: false, applyTo: "weapon", grants: { damageFlavor: "ice" } },
    stormRune: { itemClass: 'Rune', name: "Storm Rune", description: "Crackling glyph — the strike carries a jolt.", tile: 670, art: M("Icon12.png"), droppable: false, applyTo: "weapon", grants: { damageFlavor: "lightning" } },
    wardRune: { itemClass: 'Rune', name: "Ward Rune", description: "Bound into armor, it turns one kind of harm aside.", tile: 670, art: M("Icon13.png"), droppable: false, applyTo: "armor", grants: { statusResist: "one element" } },
    vitalRune: { itemClass: 'Rune', name: "Vital Rune", description: "A life-sigil; the bearer endures a little more.", tile: 670, art: M("Icon14.png"), droppable: false, applyTo: "armor|accessory", grants: { stat: "CON", value: 1 } },
}
