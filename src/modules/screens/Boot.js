import Phaser from 'phaser'

// Entry scene. Hands straight to Intro, the title screen and class picker, which
// sets dungeon.hero and then calls SceneRouter.startGame() to begin the run.
//
// Until Intro existed this started the run itself, and every game was a Wizard:
// Dungeon.placePlayer falls back to Wizard when dungeon.hero is unset, and
// nothing set it.
//
// ORDER IS LOAD-BEARING, and it now belongs to the router. The UI scene must be
// running BEFORE World, because World emits 'createUI' during its own create()
// and the UI binds that listener during its create(). Start World first and the
// event fires into nothing — the HUD silently never builds. SceneRouter.startGame
// does ui-then-world for exactly this reason; route through it rather than
// starting those two scenes from anywhere else.
export default class Boot extends Phaser.Scene {
    constructor() {
        super({ key: "Boot" })
    }

    create() {
        this.scene.start("intro-scene")
    }
}
