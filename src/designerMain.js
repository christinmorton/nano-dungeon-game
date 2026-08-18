// Dungeon Designer entry point (design doc §15). Boots a DEDICATED Phaser.Game
// with only the editor scene(s) — deliberately NOT the gameplay Game.js. The
// authoring sandbox reuses game *modules* (tiles, props, the recipe system)
// without the gameplay loop, so it stays its own page (designer.html) reachable
// at /designer.html on the dev server. As the tool grows this scene list gains
// a DesignerUI chrome scene alongside the map scene (the World + UI split).
import Phaser from "phaser"
import DesignerScene from "./modules/screens/DesignerScene.js"
import AtlasScene from "./modules/screens/AtlasScene.js"

const game = new Phaser.Game({
    type: Phaser.AUTO,
    backgroundColor: "#0a0a0a",
    pixelArt: true,
    // RESIZE mode parents the canvas to the #game flex cell, so the canvas
    // tracks the centered designer panel (not the whole window). Each scene
    // re-fits its content to the canvas on the resize event.
    scale: {
        mode: Phaser.Scale.RESIZE,
        parent: "game",
    },
    // DesignerScene (first) auto-starts as the Layout tab; AtlasScene is added
    // but starts inactive (active:false) — woken by the tab bar.
    scene: [DesignerScene, AtlasScene],
})

// Devtools handle, mirroring arenaMain.js — inspect the editor from the console.
window.designer = game

// ---- Tab bar ----------------------------------------------------------------
// The two Phaser scenes share the #game canvas; only one runs at a time. The tab
// bar sleeps one and wakes the other, and swaps the DOM that flanks the canvas.
// Wiring the DOM here (not in a scene) keeps it independent of either scene's
// lifecycle.
//
// Tabs come in three shapes, all described by the TABS table below rather than
// by a chain of booleans (there are six of them now, and each new tab used to
// mean editing five separate lines):
//
//   CANVAS tabs (Layout / Generate / Decorate) run the Designer scene and keep
//     the canvas visible, showing one `rail` section beside it. You are always
//     looking at the floor you are editing — the fill preview in particular
//     draws onto that canvas.
//   FULL tabs (Atlas) run their own scene and take the whole body width.
//   OVERLAY tabs (Dungeon / Items) are DOM forms that COVER the canvas and
//     sleep both scenes.
//
// The canvas is never display:none'd — that would collapse the RESIZE canvas to
// 0x0 and break its WebGL framebuffer — so overlays cover it instead.
const TABS = [
    { key: "layout", btn: "tabLayout", rail: "railLayout", scene: "Designer", inspector: true },
    { key: "generate", btn: "tabGenerate", rail: "railGenerate", scene: "Designer", wideRail: true },
    { key: "decorate", btn: "tabDecorate", rail: "railDecorate", scene: "Designer", wideRail: true },
    { key: "atlas", btn: "tabAtlas", scene: "Atlas" },
    { key: "dungeon", btn: "tabDungeon", panel: "dungeonPanel" },
    { key: "items", btn: "tabItems", panel: "itemsPanel" },
]

function initTabs() {
    const body = document.getElementById("body")
    const tools = document.getElementById("tools")
    const inspector = document.getElementById("inspector")
    // Tabs whose markup is missing are skipped rather than fatal, so the page
    // still boots while a tab is being built.
    const tabs = TABS.map(t => ({ ...t, el: document.getElementById(t.btn) })).filter(t => t.el)
    if (!tabs.length) return

    // Sleep a scene only if it's actually running — sleeping a never-started
    // (Atlas hasn't been opened yet) or already-sleeping scene throws.
    const sleepScene = (key) => { if (game.scene.isActive(key)) game.scene.sleep(key) }

    // DOM half of a tab switch, kept separate from the scene half so boot can
    // put the page in its starting state without touching Phaser (see below).
    const applyDom = (active) => {
        for (const t of tabs) t.el.classList.toggle("active", t === active)
        // Explicit "block" (not "") — rails and overlay panels default to
        // display:none in CSS, so clearing the inline style leaves them hidden.
        for (const t of tabs) {
            for (const id of [t.rail, t.panel]) {
                const el = id && document.getElementById(id)
                if (el) el.style.display = t === active ? "block" : "none"
            }
        }
        if (tools) tools.style.display = active.rail ? "" : "none"
        if (inspector) inspector.style.display = active.inspector ? "" : "none"
        if (body) body.classList.toggle("wide-rail", !!active.wideRail)
    }

    const showTab = (tab) => {
        const active = tabs.find(t => t.key === tab)
        if (!active) return
        applyDom(active)

        for (const key of ["Designer", "Atlas"]) {
            if (key !== active.scene) sleepScene(key)
        }
        if (active.scene) game.scene.run(active.scene)

        // Re-measure the canvas cell AFTER the panel show/hide reflow settles, so
        // Phaser resizes the canvas to the new cell width (RESIZE mode) and the
        // active scene reflows to it.
        requestAnimationFrame(() => game.scale.refresh())
    }

    for (const t of tabs) t.el.addEventListener("click", () => showTab(t.key))

    // Expose so scenes can switch tabs programmatically — the theme pickers jump
    // to the Atlas in pick mode, and the Atlas jumps back on pick.
    game.showTab = showTab

    // Boot into the tab the markup marks active (Layout) so its rail is shown —
    // rails start hidden, so without this the page opens with an empty sidebar.
    // DOM only: this runs at DOMContentLoaded, before Phaser has booted its
    // scenes, and the scene list already auto-starts the Designer scene.
    applyDom(tabs.find(t => t.el.classList.contains("active")) || tabs[0])
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTabs)
} else {
    initTabs()
}

export default game
