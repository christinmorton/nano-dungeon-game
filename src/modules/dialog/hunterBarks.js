// Role-flavored barks for the hunter archetype's search-and-close hunt.
// Data, not a hierarchy. A hunter rolls a role at spawn (unless one was
// authored onto it); the role supplies both its bark lines and its default
// persistence:
//   - relentless: always eventually beelines to the true position (inevitable)
//   - tracker:    loses the trail if it can't reacquire line of sight (evadable)
//
// Phases: "travel" (setting off toward the last-known area), "search" (checked
// a room and came up empty), "close" (dropped the act, closing in), "lose"
// (tracker only — gave up the trail). Rendered via speech.say (SpeechBubble).
// Extend by adding a role, or by authoring `hunterRole` onto an enemy later.

const ROLES = {
    assassin: {
        persistence: "tracker",
        travel: ["You can run...", "The contract is signed.", "No use hiding."],
        search: ["Where did you slip off to?", "Patience...", "*listens*"],
        close:  ["There you are.", "Hold still.", "Nothing personal."],
        lose:   ["...gone. For now.", "Another night, then.", "*melts into shadow*"],
    },
    stalker: {
        persistence: "tracker",
        travel: ["*sniffs the air*", "Fresh tracks...", "I have your scent."],
        search: ["The trail goes cold...", "*prowls*", "Close now..."],
        close:  ["Found you.", "*bares teeth*", "Run. It's better that way."],
        lose:   ["*loses the scent*", "Gone...", "*growls, low*"],
    },
    bounty: {
        persistence: "relentless",
        travel: ["Bounty's this way.", "You're worth a fortune.", "Come quietly."],
        search: ["Hiding won't help.", "I always collect.", "Only makes it longer."],
        close:  ["Time to pay up.", "End of the line.", "Got you."],
        lose:   [],   // relentless never loses the trail
    },
    zealot: {
        persistence: "relentless",
        travel: ["The light demands it.", "You cannot flee judgment.", "Repent."],
        search: ["Show yourself, heretic.", "Judgment is patient.", "You only delay it."],
        close:  ["Judgment falls!", "For the faithful!", "Your end is holy."],
        lose:   [],
    },
}

export const HUNTER_ROLES = Object.keys(ROLES)

export function rollHunterRole() {
    return HUNTER_ROLES[Math.floor(Math.random() * HUNTER_ROLES.length)]
}

// Default persistence for a role. Unknown roles default to relentless (an
// authored hunter with a custom role still gets a sane, inevitable pursuit).
export function hunterPersistence(role) {
    const r = ROLES[role]
    return (r && r.persistence) || "relentless"
}

// A bark line for a role + phase, or "" if none (e.g. a relentless role has no
// "lose" lines). Falls back to the assassin table for an unknown role.
export function hunterBark(role, phase) {
    const r = ROLES[role] || ROLES.assassin
    const lines = r[phase] || []
    if (!lines.length) return ""
    return lines[Math.floor(Math.random() * lines.length)]
}
