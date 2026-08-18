// Dedicated throwing weapons for the THROWING combat style. EQUIP one (mainhand)
// and it (a) turns Throw Knives from a weak improvised toss into a real throw that
// scales with attackPower AND folds in this weapon's own damage roll, and (b)
// grafts its special trait onto the ability via its `throwEmpower` spec — see
// abilities/throwing.js. Keep a sword/staff instead and your throws stay weak.
// They're real throwable MeleeWeapons, so you can also just wield one.
//
// Knife COUNT comes from the ability's rank, NOT the weapon. throwEmpower:
//   { ability: <Ability.name>, label, fields?: {field:+delta}, status?: 'Name' }

export default {
    balancedSteelKnives: {
        itemClass: 'MeleeWeapon',
        weaponCategory: 'dagger',
        throwable: true,
        name: "Balanced Steel Knives",
        description: "Perfectly weighted blades that fly true — the entry throwing knife. Solid, no frills.",
        tile: 375,
        art: { sheet: "32rogues-items", name: "dagger" },
        damageMin: 1,
        damageMax: 4,
        range: 2,
        droppable: true,
        throwEmpower: { ability: 'Throw Knives', label: 'Balanced Steel', fields: { armedScale: 0.1 } },
    },
    venomfangKnives: {
        itemClass: 'MeleeWeapon',
        weaponCategory: 'dagger',
        throwable: true,
        name: "Venomfang Knives",
        description: "Heavier, finer envenomed knives — a better blade than plain steel, and the poison bites whatever they touch.",
        tile: 375,
        art: { sheet: "32rogues-items", name: "dagger" },
        damageMin: 3,
        damageMax: 6,
        range: 2,
        droppable: true,
        // Poison is a MAGIC TRAIT (damageFlavor), so it bites on BOTH melee and
        // throw (via STATUS_BY_FLAVOR / throwing's flavorStatus) — not a bespoke
        // throw-only rider. Any poison-flavored weapon now poisons on throw.
        damageFlavor: 'poison',
    },
    beardedHatchets: {
        itemClass: 'MeleeWeapon',
        weaponCategory: 'axe',
        throwable: true,
        name: "Bearded Hatchets",
        description: "Stout throwing axes — the entry hatchet. Hits like a brick.",
        tile: 382,
        art: { sheet: "32rogues-items", name: "battleAxe" },
        damageMin: 2,
        damageMax: 5,
        range: 2,
        droppable: true,
        throwEmpower: { ability: 'Throw Hatchets', label: 'Bearded', fields: { armedScale: 0.1 } },
    },
    reaverTomahawks: {
        itemClass: 'MeleeWeapon',
        weaponCategory: 'axe',
        throwable: true,
        name: "Reaver Tomahawks",
        description: "Cruel, heavy tomahawks — a better axe than plain steel, and they bite through armor.",
        tile: 382,
        art: { sheet: "32rogues-items", name: "battleAxe" },
        damageMin: 4,
        damageMax: 7,
        range: 2,
        droppable: true,
        throwEmpower: { ability: 'Throw Hatchets', label: 'Reaver', fields: { armedScale: 0.1 }, status: 'Sunder' },
    },
}
