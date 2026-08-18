import Phaser from 'phaser'
import UI from './UserInterface';
import World from './World';
import GameOver from './GameOver';
import Intro from './Intro';
import QuestComplete from './QuestComplete';
import Pause from './Pause';
import Credits from './Credits';
import Profile from './Profile';
import Settings from './Settings';
import Controls from './Controls';
import VaultDeposit from './VaultDeposit';
import Shop from './Shop';
import Loadout from './Loadout';
import GuildHall from './GuildHall';
import Log from './Log';
import DeathScreen from './DeathScreen';
import UpgradeScreen from './UpgradeScreen';
import DraftScreen from './DraftScreen';

const config = {
    type: Phaser.AUTO,
    width: 80 * 16,
    height: 50 * 16,
    backgroundColor: "#000",
    parent: "game",
    pixelArt: true,
    zoom: 1,
    scene: [Intro, Loadout, GuildHall, World, UI, Pause, Credits, Profile, Settings, Controls, Log, VaultDeposit, Shop, GameOver, QuestComplete, DeathScreen, UpgradeScreen, DraftScreen],
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 }
        }
    }
}

const game = new Phaser.Game(config)

export default game;