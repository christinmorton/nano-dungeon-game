import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import gameLog from "../GameLog.js"
import { kindOf } from "../enemies/enemyKinds.js"
import { convertToAlly } from "./allegiance.js"
import { summon } from "./summon.js"
import { STAT_NAMES } from "../classes/Stats.js"
// Species trait tags (universal trait pool — pets draw from the same tags heroes do).
import toughness from "../tags/toughness.js"
import might from "../tags/might.js"
import keenEdge from "../tags/keenEdge.js"
import thorns from "../tags/thorns.js"
import evasion from "../tags/evasion.js"

// Pet bond — the "Tamed" summon bond type (encyclopedia §6.5). A pet is a
// PERSISTENT companion stored on its owner as a DESCRIPTOR (the recipe), so it
// survives summon ⇄ contain and carries its progress (bonus stats + traits). ONE
// pet per owner. Only living animals/insects can be tamed — a willing contract.
//
// Entity-agnostic: `owner` is any entity (hero OR enemy). The owner holds:
//   owner._petBond  — the persistent descriptor (identity + accrued progress)
//   owner._pet      — the live pet entity while summoned, else null
//
// This is the Tamed leg of the taxonomy; Constructs (summon.js) and Bound Spirits
// have their own rules. Constructs can't be contained — only pets + party can.

// Species → trait tag(s): the animal/insect type flavors the pet. Keyed by the
// tamed creature's class name first, then its kind as a fallback.
const SPECIES_TRAITS = {
    CaveBear: [toughness],
    DungeonBoar: [might],
    DungeonWolf: [keenEdge],
    DungeonLynx: [evasion],
    Bat: [evasion],
    Spider: [thorns],
    Scorpion: [thorns],
    Snake: [thorns],
    Crab: [toughness],
    Beetle: [toughness],
    Scarab: [toughness],
    ScarabHigher: [toughness],
}
const KIND_TRAITS = {
    animal: [keenEdge],
    insect: [thorns],
}

const TAMEABLE_KINDS = ['animal', 'insect', 'creature']

export function isTameable(beast) {
    return !!beast && TAMEABLE_KINDS.includes(kindOf(beast))
}

export function petIsSummoned(owner) {
    return !!(owner?._pet && owner._pet.sprite)
}

function speciesTraitsFor(beast) {
    return SPECIES_TRAITS[beast?.constructor?.name] || KIND_TRAITS[kindOf(beast)] || []
}

function snapshotStats(stats) {
    const out = {}
    for (const n of STAT_NAMES) out[n] = stats?.[n] ?? 0
    return out
}

// base stats + accrued bonusStats → the merged sheet passed to the spawned pet.
function mergedStats(descriptor) {
    const out = { ...descriptor.stats }
    for (const n of STAT_NAMES) out[n] = (out[n] ?? 0) + (descriptor.bonusStats[n] ?? 0)
    return out
}

function applyPetTraits(pet, traits) {
    for (const t of traits || []) pet.addTag(t)
}

// First open tile around the owner (8-neighbourhood) for a pet to appear on.
function freeTileNear(owner) {
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]]
    for (const [dx, dy] of dirs) {
        const x = owner.x + dx, y = owner.y + dy
        if (mapState.isWalkableTile(x, y)) return { x, y }
    }
    return null
}

// Bond a tamed beast to the owner as its ONE pet. Refuses if the owner already
// has a pet (cap 1). The wounded beast is flipped in place (convertToAlly) into
// the live pet, and a persistent descriptor is captured for future re-summons.
export function bondPet(owner, beast) {
    if (!owner || !beast) return false
    if (owner._petBond) { gameLog.log(`${owner.name} already has a pet.`); return false }

    const traits = speciesTraitsFor(beast)
    owner._petBond = {
        name: beast.name,
        species: beast.constructor?.name ?? 'beast',
        stats: snapshotStats(beast.stats),
        bonusStats: {},                 // accrued via empowerPet — the "progress"
        maxHp: beast.maxHealthPoints,
        art: beast.art ?? null,
        tint: beast.tint ?? 0x88ccff,
        weaponName: beast.weapon?.name ?? 'fangs',
        traits,                         // species + earned trait templates
    }
    convertToAlly(beast, owner)         // flip in place → the live pet (no loot, joins party)
    beast.bondType = 'pet'
    beast.actsImmediately = true        // act right after the owner's turn (see ally.js / TurnManager)
    // Bonding mends the beast — a fresh companion starts whole rather than at the
    // sliver of HP you wore it down to (matches the summon-from-descriptor path,
    // which also spawns at full HP).
    beast.healthPoints = beast.maxHealthPoints
    applyPetTraits(beast, traits)
    owner._pet = beast
    return true
}

// Summon the pet from its descriptor onto an open tile near the owner. No-op if
// already out, or if there's no bond / no room. Spawned at full HP (contain =
// rest); persistent progress (bonusStats/traits) rides the descriptor.
export function summonPet(owner, atTile = null) {
    const d = owner?._petBond
    if (!d) { gameLog.log(`${owner?.name ?? 'They'} have no pet to summon.`); return false }
    if (petIsSummoned(owner)) return false
    const tile = atTile || freeTileNear(owner)
    if (!tile) { gameLog.log(`No room to summon the pet.`); return false }

    const pet = summon(owner, {
        tile,
        summonKind: 'pet',
        archetype: 'ally',
        bondType: 'pet',
        name: d.name,
        stats: mergedStats(d),
        hp: d.maxHp,
        art: d.art,
        tint: d.tint,
        weaponName: d.weaponName,
    })
    if (!pet) return false
    pet.actsImmediately = true          // act right after the owner's turn
    owner._pet = pet
    applyPetTraits(pet, d.traits)
    gameLog.log(`${owner.name} summons ${d.name}.`)
    return true
}

// Pull the live pet off-board (the bond + progress persist on the descriptor).
// Pets + party are the ONLY containable summons. Ally removal drops no loot.
export function containPet(owner) {
    if (!petIsSummoned(owner)) return false
    dungeon.removeEntity(owner._pet)
    owner._pet = null
    gameLog.log(`${owner.name} contains their pet.`)
    return true
}

// Toggle: contain if out, summon if contained. The Pet command's action.
export function petToggle(owner) {
    return petIsSummoned(owner) ? containPet(owner) : summonPet(owner)
}

// Sever the bond entirely — the pet AND all its progress are lost. Called when
// the owner loses the Tame passive (the dependency rule).
export function dismissPet(owner) {
    if (petIsSummoned(owner)) dungeon.removeEntity(owner._pet)
    const had = !!owner._petBond
    owner._pet = null
    owner._petBond = null
    if (had) gameLog.log(`${owner.name}'s pet bond is severed.`)
    return had
}

// The progression hook: grow the pet alongside the owner (mini-hero). Adds bonus
// stats and/or a universal trait to the bond (so it persists across summon/contain)
// and to the live pet if it's out. The future progression system calls this when
// the owner gains a powerup; for now it's invoked manually / on the bench.
export function empowerPet(owner, { stat = 'STR', amount = 1, trait = null } = {}) {
    const d = owner?._petBond
    if (!d) return false
    if (stat && amount) d.bonusStats[stat] = (d.bonusStats[stat] ?? 0) + amount
    if (trait && !d.traits.includes(trait)) d.traits.push(trait)
    if (petIsSummoned(owner)) {
        const pet = owner._pet
        if (stat && amount) pet.stats[stat] = (pet.stats[stat] ?? 0) + amount
        if (trait) pet.addTag(trait)
    }
    return true
}

// --- Runtime ability granting (entity-agnostic) ---------------------------
// Add/remove an ability instance on an owner at runtime (the Tame passive grants
// TameBeast; taming grants PetCommand). Refreshes the owner's HUD if it has one.
export function grantAbility(owner, AbilityClass) {
    if (!owner) return null
    if (!owner.abilities) owner.abilities = []
    if (owner.abilities.some(a => a instanceof AbilityClass)) return null
    const ability = new AbilityClass(owner)
    owner.abilities.push(ability)
    owner.hud?.refresh?.()
    return ability
}

export function removeAbility(owner, AbilityClass) {
    if (!owner?.abilities) return false
    const i = owner.abilities.findIndex(a => a instanceof AbilityClass)
    if (i < 0) return false
    owner.abilities.splice(i, 1)
    owner.hud?.refresh?.()
    return true
}
