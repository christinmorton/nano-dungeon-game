// Reinforcer — a join-eligibility marker. An enemy carrying this tag is one
// of the few that may cross into an ACTIVE arena and add itself to the fight
// (the EncounterManager admission pass reads it). Untagged enemies treat an
// active arena as a separate dimension they can't perceive — they phase out
// while passing through. See documents/v3_objective_driven_encounters.md.
//
// Pure marker: no behavior, no lifecycle. addTag still calls initialize(),
// so a no-op is required. Assigned per-recipe via a member's `tags` list.
const reinforcer = {
    name: "Reinforcer",
    initialize: function () {}
}

export default reinforcer
