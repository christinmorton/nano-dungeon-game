import Phaser from 'phaser'
import { renderEndScreen } from './EndScreen.js'
import router from '../SceneRouter.js'

export default class QuestComplete extends Phaser.Scene {
    constructor() {
        super({ key: "quest-complete-scene", active: false })
    }

    create() {
        // Wins go through the vault deposit phase first; the score breakdown
        // renders only after the player commits their deposit choices.
        const depositScene = this.scene.get("vault-deposit-scene")
        depositScene.events.once("shutdown", () => {
            renderEndScreen(this, { title: "Quest Complete", isWin: true })
        })
        router.bind(this)
        router.openVaultDeposit()
    }
}
