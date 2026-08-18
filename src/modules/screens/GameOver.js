import Phaser from 'phaser'
import { renderEndScreen } from './EndScreen.js'

export default class GameOver extends Phaser.Scene {
    constructor() {
        super({ key: "game-over-scene", active: false })
    }

    create() {
        renderEndScreen(this, { title: "Game Over", isWin: false })
    }
}
