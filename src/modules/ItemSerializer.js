import items, { registryKeyForProfile } from "./Items.js"

// Reverse-lookup the registered class name for an item instance. Done via
// instanceof rather than constructor.name so production minification of
// class names doesn't break vault persistence.
function classNameOf(item) {
    // Profile items (makeItem) are registered as factory FUNCTIONS, so `instanceof`
    // can't recover their name — they carry an explicit profileKey. Resolve it to
    // the registry key (aliased weapons/armor live under a capitalized alias, NOT
    // the lowercase profileKey, so a bare lookup misses them); fall back to
    // instanceof for true class items (Gem, CursedGem, …).
    if (item && item.profileKey) {
        const key = registryKeyForProfile(item.profileKey)
        if (key) return key
    }
    for (const name of Object.keys(items)) {
        if (item instanceof items[name]) return name
    }
    return null
}

export function serialize(item) {
    const className = classNameOf(item)
    if (!className) return null
    const tags = (item._tags || []).slice()
    return { className, tags }
}

export function deserialize(record) {
    if (!record || !record.className) return null
    const Cls = items[record.className]
    if (!Cls) return null
    // Item constructors with no x/y skip sprite creation in GenericItem —
    // the same pattern hero classes use to push starting items.
    const instance = new Cls()
    if (Array.isArray(record.tags) && record.tags.length) {
        instance.addTags(record.tags)
    }
    return instance
}

export function isDepositable(item) {
    if (!item) return false
    if (item.cursed) return false
    // Tally items (Gem, DungeonKey) never sit in inventory anyway, but
    // guard explicitly in case future items expose a tallyKey.
    if (item.tallyKey) return false
    return classNameOf(item) !== null
}
