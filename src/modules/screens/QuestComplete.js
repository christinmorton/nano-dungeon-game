import Phaser from 'phaser'
import { renderEndScreen } from './EndScreen.js'

// The win screen.
//
// v3 routed wins through a vault-deposit phase first, waiting on that scene's
// "shutdown" event before rendering the score. The vault is part of the
// meta-progression layer v5 cuts, and "vault-deposit-scene" is not registered —
// so that listener would have waited on an event that could never fire, leaving
// the player on a black screen at the exact moment they won. Renders directly.
export default class QuestComplete extends Phaser.Scene {
    constructor() {
        super({ key: "quest-complete-scene", active: false })
    }

    create() {
        renderEndScreen(this, { title: "Quest Complete", isWin: true })
    }
}
