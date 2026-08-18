import enemies from "../Enemies.js"

// Settlement profiles — one JSON per species under
// data/settlements/profiles/. A profile defines a species' identity for the
// settlement generator: its weighted role palette, per-form leaders, and
// decor props. Forms (the scale tiers — encampment / fortress / legion) are
// shared and live in data/settlements/forms.json.
//
// Glob-discovered like recipes (see RecipeLoader.js), so adding a new species
// is a drop-in file with no code change — the whole point of the
// (species x form) system. Light validation fails fast at startup on a bad
// enemy-class reference rather than silently spawning a broken band.
//
// See documents/v3_enemy_settlements.md for the design and the deliberately
// deferred faction/disposition layer.

const modules = import.meta.glob("../../data/settlements/profiles/*.json", {
    eager: true,
    import: "default"
})

function sourcePathOf(modulePath) {
    return modulePath.replace(/^\.\.\/\.\.\//, "code/v3/src/")
}

function validate(profile, file) {
    if (!profile || typeof profile !== "object") {
        throw new Error(`Settlement profile ${file} :: (root) -> must be a JSON object`)
    }
    if (typeof profile.species !== "string" || !profile.species) {
        throw new Error(`Settlement profile ${file} :: species -> missing or not a non-empty string`)
    }
    if (!Array.isArray(profile.roles) || profile.roles.length === 0) {
        throw new Error(`Settlement profile ${file} :: roles -> must be a non-empty array`)
    }
    profile.roles.forEach((role, i) => {
        if (!role || typeof role.class !== "string" || !enemies[role.class]) {
            throw new Error(
                `Settlement profile ${file} :: roles[${i}].class -> unknown enemy class "${role && role.class}"`)
        }
    })
}

const profilesBySpecies = {}
for (const [modulePath, profile] of Object.entries(modules)) {
    const file = sourcePathOf(modulePath)
    validate(profile, file)
    if (profilesBySpecies[profile.species]) {
        throw new Error(`Settlement profile ${file} :: species "${profile.species}" -> duplicate profile`)
    }
    profilesBySpecies[profile.species] = profile
}

export default profilesBySpecies
