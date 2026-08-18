// Formalizes the status-effect shape on top of the Taggable pipeline.
// A status IS a tag — a plain template consumed by Taggable.addTag — but
// defineStatus() also records its metadata (category, valence, icon,
// default duration) in a registry keyed by the tag's display name, which
// is the same string stored in entity._tags. Cleanse / Dispel (verb
// system) and the status HUD look metadata up by that name.
//
// The factory returns ONLY { name, initialize, ...hooks }, so Taggable's
// own-key iteration is unchanged and metadata never gets wired as a fake
// hook handler. Each status keeps its own bespoke duration ticking inside
// its hooks; the `duration` field here is declarative reference, not a
// mechanic the factory enforces.

export const VALENCES = ["positive", "negative", "mixed"]

// Categories mirror documents/v3_status_effects.md. Declarative for now;
// the verb system and HUD filter on `valence`, category is for grouping.
export const CATEGORIES = [
    "buff", "debuff", "dot", "cc",
    "alteration", "progression", "spatial", "shop"
]

const statusRegistry = {}
// Taggable templates by display name. Kept separate from the metadata
// registry so Cleanse/Dispel can call entity.removeTag(template) —
// removeTag matches handlers by function reference, so it needs the exact
// template object, not just the name.
const statusTemplates = {}

export function defineStatus(config) {
    const { name, category = null, valence = "mixed", icon = null,
            duration = null, fx = null, ...hooks } = config

    statusRegistry[name] = { name, category, valence, icon, duration, fx }

    const template = { name, ...hooks }
    // Taggable.addTag calls template.initialize.apply(entity); guarantee one
    // so statuses with no setup can omit it.
    if (typeof template.initialize !== "function") template.initialize = function () {}
    statusTemplates[name] = template
    return template
}

export function getStatusTemplate(name) {
    return statusTemplates[name] ?? null
}

export function getStatusMeta(name) {
    return statusRegistry[name] ?? null
}

export function allStatusMeta() {
    return Object.values(statusRegistry)
}

// Active statuses on an entity resolved to metadata. Names with no
// registered metadata (materials, modifiers, roles) are skipped, so this
// returns only true status effects from a mixed _tags list.
export function statusesOnEntity(entity) {
    return (entity._tags || []).map(getStatusMeta).filter(Boolean)
}

export function negativeStatusesOn(entity) {
    return statusesOnEntity(entity).filter(s => s.valence === "negative")
}

export function positiveStatusesOn(entity) {
    return statusesOnEntity(entity).filter(s => s.valence === "positive")
}
