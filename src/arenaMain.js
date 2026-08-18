// Arena entry point — sets ARENA_MODE before any game module reads it,
// then boots the same Phaser scene chain as the real game. mapState.start
// notices the flag and swaps the BSP floor sequence for a single fixed
// ArenaLevel so AI behavior can be verified in isolation.
window.ARENA_MODE = true

// Devtools exposure for arena testing. Inspect entity state, the turn
// manager, and the active scene directly from the browser console. Only
// on the arena page — index.html (the real game) doesn't pollute window.
import tm from "./modules/TurnManager.js"
import dungeon from "./modules/Dungeon.js"
import mapState from "./modules/MapState.js"
import training from "./modules/trainingHelpers.js"
window.tm = tm
window.dungeon = dungeon
window.mapState = mapState
// A->Z ability bench helpers (used with arena.html?training). Safe to expose
// always — the functions no-op gracefully until a TrainingLevel hero exists.
window.training = training

import "./modules/screens/Game.js"
