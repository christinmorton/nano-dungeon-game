const SCENES = {
    intro: "intro-scene",
    world: "world-scene",
    ui: "ui-scene",
    pause: "pause-scene",
    credits: "credits-scene",
    profile: "profile-scene",
    settings: "settings-scene",
    controls: "controls-scene",
    character: "character-scene",
    vaultDeposit: "vault-deposit-scene",
    shop: "shop-scene",
    loadout: "loadout-scene",
    guildHall: "guild-hall-scene",
    upgrade: "upgrade-scene",
    draft: "draft-scene",
    gameOver: "game-over-scene",
    questComplete: "quest-complete-scene",
    log: "log-scene",
    death: "death-scene"
}

class SceneRouter {
    bind(scene) {
        this.scene = scene
    }

    _mgr() {
        return this.scene && this.scene.scene
    }

    startGame() {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.stop(SCENES.intro)
        mgr.run(SCENES.ui)
        mgr.run(SCENES.world)
    }

    endRun(outcome) {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.stop(SCENES.ui)
        mgr.stop(SCENES.world)
        mgr.start(outcome === "win" ? SCENES.questComplete : SCENES.gameOver)
    }

    // Hero death: pause (not stop) World+UI so the dimmed dungeon and tombstone
    // stay visible, and launch the modal DeathScreen over them. The death
    // screen's choices route onward (End Run -> endRun, Restart -> toMenu).
    showDeath() {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.launch(SCENES.death)
        mgr.pause(SCENES.world)
        mgr.pause(SCENES.ui)
    }

    // Revive: resume the World+UI that showDeath paused. The DeathScreen stops
    // itself before calling this.
    resumeFromDeath() {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.resume(SCENES.world)
        mgr.resume(SCENES.ui)
    }

    openPause() {
        const mgr = this._mgr()
        if (!mgr || mgr.isActive(SCENES.pause)) return
        // Same-press debounce: if Pause's keyup just resumed and the same
        // Escape event also reaches BaseHero, this 200ms window stops it
        // from immediately re-opening pause.
        const now = Date.now()
        if (this._lastToggle && (now - this._lastToggle) < 200) return
        this._lastToggle = now
        mgr.launch(SCENES.pause)
    }

    closePause() {
        const mgr = this._mgr()
        if (!mgr) return
        this._lastToggle = Date.now()
        mgr.stop(SCENES.pause)
    }

    openCredits() {
        const mgr = this._mgr()
        if (!mgr || mgr.isActive(SCENES.credits)) return
        mgr.launch(SCENES.credits)
    }

    closeCredits() {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.stop(SCENES.credits)
    }

    openProfile() {
        const mgr = this._mgr()
        if (!mgr || mgr.isActive(SCENES.profile)) return
        mgr.launch(SCENES.profile)
    }

    closeProfile() {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.stop(SCENES.profile)
    }

    openSettings() {
        const mgr = this._mgr()
        if (!mgr || mgr.isActive(SCENES.settings)) return
        mgr.launch(SCENES.settings)
    }

    closeSettings() {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.stop(SCENES.settings)
    }

    // The Controls (keybinds) screen is a full handoff from Settings — stop
    // Settings and launch Controls — so only one of the two is ever active at a
    // time. That sidesteps a multi-scene Escape race (both owning Escape). Back
    // from Controls reopens Settings fresh (Settings rebuilds from prefs).
    // Controls overlays whatever opened it — the Intro title screen, or Pause
    // mid-run — and closing just stops it, so the caller reappears underneath
    // untouched. World and UI are already paused if we came in through Pause,
    // and Intro needs no pausing, so neither is touched here.
    //
    // v3's version swapped Controls with a Settings screen. v5 registers no
    // Settings scene, so keeping that would have made closing this screen
    // launch a scene that does not exist — a black overlay with no way out,
    // the same soft-lock the K key had.
    // The caller is PAUSED while Controls is up, and resumed on close. This is
    // not cosmetic: a Phaser scene that is merely covered still receives input.
    // Without the pause, Escape inside Controls would close Controls *and* be
    // heard by Pause underneath, resuming the run; and a click meant to dismiss
    // Controls would also land on an Intro class card and start a game. Pausing
    // disables the covered scene's input plugin, which is exactly the wanted
    // behaviour and is reversed on resume.
    openControls() {
        const mgr = this._mgr()
        if (!mgr || mgr.isActive(SCENES.controls)) return
        this._controlsCaller = this.scene?.scene?.key || null
        if (this._controlsCaller) mgr.pause(this._controlsCaller)
        mgr.launch(SCENES.controls)
    }

    closeControls() {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.stop(SCENES.controls)
        if (this._controlsCaller) {
            mgr.resume(this._controlsCaller)
            this._controlsCaller = null
        }
    }

    // The Character screen. Reached from the dungeon (the `character` key) and
    // from Pause, so it follows the Controls pattern: pause whoever opened it,
    // resume them on close. From the dungeon that means World AND UI, as Shop
    // does, so the HUD underneath stops hearing clicks too.
    //
    // The 200ms debounce is the openPause one: the key both opens and closes
    // this screen, and the keyup that closes it can reach the just-resumed
    // World in the same dispatch and reopen it.
    openCharacter() {
        const mgr = this._mgr()
        if (!mgr || mgr.isActive(SCENES.character)) return
        const now = Date.now()
        if (this._lastCharacterToggle && (now - this._lastCharacterToggle) < 200) return
        this._lastCharacterToggle = now
        this._characterCaller = this.scene?.scene?.key || null
        if (this._characterCaller) mgr.pause(this._characterCaller)
        if (this._characterCaller === SCENES.world) mgr.pause(SCENES.ui)
        mgr.launch(SCENES.character)
    }

    closeCharacter() {
        const mgr = this._mgr()
        if (!mgr) return
        this._lastCharacterToggle = Date.now()
        mgr.stop(SCENES.character)
        if (this._characterCaller) {
            mgr.resume(this._characterCaller)
            if (this._characterCaller === SCENES.world) mgr.resume(SCENES.ui)
            this._characterCaller = null
        }
    }

    openVaultDeposit() {
        const mgr = this._mgr()
        if (!mgr || mgr.isActive(SCENES.vaultDeposit)) return
        mgr.launch(SCENES.vaultDeposit)
    }

    closeVaultDeposit() {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.stop(SCENES.vaultDeposit)
    }

    // Talking to a shopkeeper: pause (not stop) World+UI so the dungeon
    // freezes underneath while the modal shop screen is open, then resume
    // on close. Mirrors showDeath/resumeFromDeath. The shopkeeper instance
    // is handed to the scene via launch data.
    openShop(shopkeeper) {
        const mgr = this._mgr()
        if (!mgr || mgr.isActive(SCENES.shop)) return
        mgr.launch(SCENES.shop, { shopkeeper })
        mgr.pause(SCENES.world)
        mgr.pause(SCENES.ui)
    }

    closeShop() {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.stop(SCENES.shop)
        mgr.resume(SCENES.world)
        mgr.resume(SCENES.ui)
    }

    openLoadout() {
        const mgr = this._mgr()
        if (!mgr || mgr.isActive(SCENES.loadout)) return
        mgr.launch(SCENES.loadout)
    }

    closeLoadout() {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.stop(SCENES.loadout)
    }

    // The Guild Hall (roster + Fallen wall + revive). Launched as an overlay from
    // the Intro menu, like Profile. "Embark" closes it and calls startGame.
    openGuildHall() {
        const mgr = this._mgr()
        if (!mgr || mgr.isActive(SCENES.guildHall)) return
        mgr.launch(SCENES.guildHall)
    }

    closeGuildHall() {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.stop(SCENES.guildHall)
    }

    // The skillbook / spend-points upgrade screen (§14 B7). Modal like the shop:
    // pause World+UI so the dungeon freezes underneath, resume on close.
    openUpgrade() {
        const mgr = this._mgr()
        if (!mgr || mgr.isActive(SCENES.upgrade)) return
        mgr.launch(SCENES.upgrade)
        mgr.pause(SCENES.world)
        mgr.pause(SCENES.ui)
    }

    closeUpgrade() {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.stop(SCENES.upgrade)
        mgr.resume(SCENES.world)
        mgr.resume(SCENES.ui)
    }

    // The milestone ability draft (§14 B5/B6). Modal like the upgrade screen.
    openDraft() {
        const mgr = this._mgr()
        if (!mgr || mgr.isActive(SCENES.draft)) return
        mgr.launch(SCENES.draft)
        mgr.pause(SCENES.world)
        mgr.pause(SCENES.ui)
    }

    closeDraft() {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.stop(SCENES.draft)
        mgr.resume(SCENES.world)
        mgr.resume(SCENES.ui)
    }

    openLog() {
        const mgr = this._mgr()
        if (!mgr || mgr.isActive(SCENES.log)) return
        mgr.launch(SCENES.log)
    }

    closeLog() {
        const mgr = this._mgr()
        if (!mgr) return
        mgr.stop(SCENES.log)
    }

    toMenu() {
        // Hard reset is the simplest reliable path back to a clean Intro:
        // run state is on the Dungeon singleton, not in scene data, and
        // location.reload was already the established reset mechanism.
        if (typeof location !== "undefined") location.reload()
    }
}

const router = new SceneRouter()
router.SCENES = SCENES
export default router
