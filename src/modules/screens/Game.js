import Phaser from 'phaser'
import Boot from './Boot.js'
import Intro from './Intro.js'
import World from './World.js'
import UserInterface from './UserInterface.js'
import Pause from './Pause.js'
import Log from './Log.js'
import Controls from './Controls.js'
import Shop from './Shop.js'
import Character from './Character.js'
import DeathScreen from './DeathScreen.js'
import GameOver from './GameOver.js'
import QuestComplete from './QuestComplete.js'

// v5 scene registry. v3 registers 18; this is three, and the scope doc governs
// what may be added (documents/v5_scope_and_cut_list.md).
//
// Every scene but Boot declares `active: false`, so none starts on its own. Boot
// is the only scene that runs at boot, and it starts Intro (the title screen and
// class picker). Intro hands off through SceneRouter.startGame(), which brings up
// the UI and World in the order those two require.
//
// No `physics` block: v3 configured arcade physics with zero gravity, but this is
// a turn-based grid game and nothing reads it.
const config = {
    type: Phaser.AUTO,
    width: 80 * 16,
    height: 50 * 16,
    backgroundColor: "#000",
    parent: "game",
    pixelArt: true,
    zoom: 1,
    // The 1280x800 above is the DESIGN resolution, not the display size. FIT
    // scales the canvas to whatever box the #game div occupies while preserving
    // aspect ratio, which is what makes the build survive an itch.io iframe and
    // any browser window smaller than 1280 wide. Without this the canvas is a
    // fixed 1280x800 and gets cropped or scrollbarred.
    //
    // This depends on #game having a real box — see the stylesheet in
    // index.html. A parent with zero height fits against nothing.
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [Boot, Intro, World, UserInterface, Pause, Log, Controls, Shop, Character, DeathScreen, GameOver, QuestComplete],
}

const game = new Phaser.Game(config)

export default game
