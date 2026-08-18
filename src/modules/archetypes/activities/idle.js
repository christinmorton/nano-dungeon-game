// Idle activity — captain is between events, waiting on a cooldown,
// scout return, or just resting between scripted moments. No active
// behavior; the captain consumes its turn doing nothing visible.
// Matches the pre-activity-layer "not engaged" behavior so this slice
// is a no-op for the player.
//
// Future activities (scouting / patrolling / hunting / scavenging)
// land as siblings of this file and get registered in
// activities/index.js. See documents/v3_enemy_squad_design.md.
export default function idle(captain, player) {
    captain.movementPoints = 0
    captain.actionPoints = 0
}
