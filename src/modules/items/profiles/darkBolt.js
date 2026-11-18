// The Dark Sorcerer's channelled bolt (scope doc §10.12).
//
// It previously carried the player's `wand` — an APPRENTICE weapon, 1-4 damage
// at range 5, explicitly described as "plain arcane make, no Element bound". A
// master caster wielding the tutorial wand is most of why the Dark Sorcerer read
// as harmless, and raising the wand's numbers was not an option: the player's
// Wizard starts with it.
//
// v3 hit this from the other side. It gave the class a weapon whose NAME was
// changed to "dark bolt" while it stayed a virtual MELEE stub, so a sorcerer
// walked up and punched you. This is that weapon actually built: a real
// RangedWeapon, so archetypes/archer.js can read range()/minRange() and kite
// with it, and a non-physical damageType so it routes through the magic
// projectile path (only an arcane wall stops it).
//
// `droppable: false` — this is the sorcerer's own conduit, not loot. The
// humanoid drop table has a branch that drops the equipped mainhand, which would
// otherwise hand the player a caster weapon no class is built to use. v5 did not
// read this field at all (it is a v3 convention); BaseEnemy's drop branch now
// honours it alongside the existing `virtual` check.
export default {
    itemClass: 'RangedWeapon',
    weaponCategory: 'arcane',
    throwable: false,
    droppable: false,
    name: "Dark Bolt",
    description: "A channelled lance of void-light, thrown from an open hand.",
    tile: 768,
    art: { sheet: "32rogues-items", name: "crystalStaff" },
    damageType: 'magic',
    attackPowerStat: 'magicPower',
    attackTile: 567,
    // Violet rather than the wand's paler arcane, so the sorcerer's fire reads as
    // a different and nastier thing arriving than a goblin's arrow.
    damageColor: 0x9b59d0,
    // 3-7 until 2026-10-04 (§10.18): with Magic 14-18 behind it that was 17-25 a
    // shot against a hero of 440-600 HP — a plinker. 5-10 on top of the depth
    // scaling is what makes ignoring the priest cost something.
    damageMin: 5,
    damageMax: 10,
    // Outranges the bow (7) by a tile. The sorcerer is meant to be the thing that
    // opens fire first, and archer.js's detectionRadius of 8 plus this class's
    // own 10 means it can actually reach that far before the player closes.
    range: 8,
    minRange: 1,
}
