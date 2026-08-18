import Phaser from "phaser"
import TestScreen from "./modules/screens/TestScreen.js"

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 800,
    backgroundColor: "#1a1a1a",
    parent: "game",
    pixelArt: true,
    zoom: 1,
    scene: [TestScreen]
}

new Phaser.Game(config)
