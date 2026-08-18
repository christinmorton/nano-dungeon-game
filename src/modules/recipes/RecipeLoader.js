import enemies from "../Enemies.js"

// Squad recipes — JSON-defined band templates that the level generator
// (or arena override) reads to spawn a thematically coherent group of
// enemies + captain. Recipes live in code/v3/src/data/recipes/*.json,
// one file per recipe, glob-discovered by Vite at startup. The validator
// resolves every string reference against the live registries and throws
// with file + field path on the first typo, so the dev server fails fast
// rather than silently spawning a broken band at runtime.
//
// See documents/v3_enemy_squad_design.md for the design and the
// composition surface this loader supports.

const VALID_PLAYBOOKS = ["blitz", "formation", "freeform"]

// Captain activities shipped so far. New activities (hunting /
// scavenging) get added here as they land. Same fail-fast principle
// as roles — unknown values caught at startup. "claiming" is set
// internally by scouting when the intel threshold is met; recipes
// generally won't reference it but the validator allows the string
// either way for completeness.
const VALID_ACTIVITIES = ["idle", "patrolling", "scouting", "claiming"]

// Roles shipped so far. The validator treats this list as the source
// of truth — a recipe referencing an unimplemented role fails at
// startup, not silently at spawn.
const VALID_ROLES = ["archer", "tank", "warrior", "caster", "healer"]

const WILDCARD = "*"

const modules = import.meta.glob("../../data/recipes/*.json", {
    eager: true,
    import: "default"
})

function sourcePathOf(modulePath) {
    return modulePath.replace(/^\.\.\/\.\.\//, "code/v3/src/")
}

function fail(file, where, reason) {
    throw new Error(`Recipe ${file} :: ${where} -> ${reason}`)
}

function validateRecipe(recipe, file) {
    if (!recipe || typeof recipe !== "object") {
        fail(file, "(root)", "recipe must be a JSON object")
    }
    if (typeof recipe.name !== "string" || !recipe.name) {
        fail(file, "name", "missing or not a non-empty string")
    }
    if (typeof recipe.species !== "string" || !recipe.species) {
        fail(file, "species", "missing or not a non-empty string")
    }
    if (!recipe.captain || typeof recipe.captain !== "object") {
        fail(file, "captain", "missing or not an object")
    }
    if (recipe.captain.tile != null && typeof recipe.captain.tile !== "number") {
        fail(file, "captain.tile", "must be a number when present")
    }
    if (recipe.captain.playbook != null) {
        const pb = recipe.captain.playbook
        if (pb !== WILDCARD && !VALID_PLAYBOOKS.includes(pb)) {
            fail(file, "captain.playbook",
                `unknown playbook "${pb}" — expected one of ${VALID_PLAYBOOKS.join(", ")} or "${WILDCARD}"`)
        }
    }
    if (recipe.captain.activity != null) {
        const act = recipe.captain.activity
        if (act !== WILDCARD && !VALID_ACTIVITIES.includes(act)) {
            fail(file, "captain.activity",
                `unknown activity "${act}" — expected one of ${VALID_ACTIVITIES.join(", ")} or "${WILDCARD}"`)
        }
    }
    if (!Array.isArray(recipe.members) || recipe.members.length === 0) {
        fail(file, "members", "must be a non-empty array")
    }
    recipe.members.forEach((member, i) => {
        if (!member || typeof member !== "object") {
            fail(file, `members[${i}]`, "must be an object")
        }
        if (typeof member.class !== "string" || !member.class) {
            fail(file, `members[${i}].class`, "missing or not a non-empty string")
        }
        if (!enemies[member.class]) {
            fail(file, `members[${i}].class`,
                `unknown enemy class "${member.class}" — not present in the Enemies registry`)
        }
        if (member.role != null) {
            if (member.role !== WILDCARD && !VALID_ROLES.includes(member.role)) {
                const expected = VALID_ROLES.length > 0
                    ? `${VALID_ROLES.join(", ")} or "${WILDCARD}"`
                    : `(no roles registered yet) or "${WILDCARD}"`
                fail(file, `members[${i}].role`,
                    `unknown role "${member.role}" — expected one of ${expected}`)
            }
        }
    })
}

const recipesByName = {}
const recipeSourceFile = new WeakMap()

for (const [modulePath, recipe] of Object.entries(modules)) {
    const file = sourcePathOf(modulePath)
    validateRecipe(recipe, file)
    if (recipesByName[recipe.name]) {
        const previous = recipeSourceFile.get(recipesByName[recipe.name])
        throw new Error(`Recipe ${file} :: name "${recipe.name}" -> duplicate of recipe defined in ${previous}`)
    }
    recipesByName[recipe.name] = recipe
    recipeSourceFile.set(recipe, file)
}

const recipeLoader = {
    byName(name) {
        return recipesByName[name] ?? null
    },
    all() {
        return Object.values(recipesByName)
    },
    names() {
        return Object.keys(recipesByName)
    },
    pickRandom() {
        const names = this.names()
        if (names.length === 0) return null
        return recipesByName[names[Math.floor(Math.random() * names.length)]]
    },
    sourceFileOf(recipe) {
        return recipeSourceFile.get(recipe) ?? null
    }
}

export default recipeLoader
