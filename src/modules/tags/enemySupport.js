// Enemy-Support — the second join-eligibility marker (alongside Reinforcer).
// Same admission semantics: a unit tagged Enemy-Support may cross into an
// active arena and join the fight; everyone else phases out. Split from
// Reinforcer so a recipe can distinguish a support role (healer / buffer that
// rushes in) from a straight reinforcement, even though they gate identically
// for now. See documents/v3_objective_driven_encounters.md.
//
// Pure marker: no behavior. addTag calls initialize(), so a no-op is required.
const enemySupport = {
    name: "Enemy-Support",
    initialize: function () {}
}

export default enemySupport
