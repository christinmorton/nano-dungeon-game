// Objective kinds for a Battle — the win condition the encounter manager
// evaluates each tick. Data + a `kind` string, NOT a class hierarchy (the
// kind-over-hierarchy rule the project follows). 'eliminate' is the DEFAULT
// and reproduces the original roster-clear win exactly, so the spine doesn't
// regress. Non-kill kinds (catch / survive / protect …) slot in here later.
// See documents/v3_objective_driven_encounters.md.
//
// Each kind exposes:
//   progress(battle) -> 0..1   normalized, for the ObjectiveMeter view
//   status(battle)   -> string short label for the meter
//   evaluate(battle) -> 'won' | 'failed' | null   (null = still ongoing)

export const OBJECTIVES = {
    eliminate: {
        label: 'Defeat the enemies',
        // Fraction of the peak roster no longer in the fight (killed, fled, or
        // conceded). Reaches 1 when the roster is empty — so flee/kill both
        // move the bar, and it lands full exactly when the battle resolves.
        progress(battle) {
            const peak = battle.record.rosterPeak || 0
            if (peak === 0) return 0
            return (peak - battle.roster.size) / peak
        },
        status(battle) {
            const n = battle.roster.size
            return `${n} ${n === 1 ? 'enemy' : 'enemies'} left`
        },
        evaluate(battle) {
            return battle.roster.size === 0 ? 'won' : null
        }
    }
}

// Build an objective instance for a battle. Spreads the kind's behavior onto a
// plain object carrying its `kind` so callers can branch / display on it.
export function makeObjective(kind = 'eliminate') {
    const spec = OBJECTIVES[kind] || OBJECTIVES.eliminate
    return { kind, ...spec }
}
