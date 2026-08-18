import AssetBrowser from "./AssetBrowser.js"

// The standalone Tile Reference page (test.html, testMain.js): browse every
// catalogued sheet and click a tile to copy its `sheet.group.name` path.
//
// All behavior now lives in the shared AssetBrowser base (extracted so the
// designer's Atlas tab shares one browser and can't drift from this page). This
// is just the fixed-size host; the default onPick = copy-to-clipboard, which is
// exactly what this page has always done. See AssetBrowser.js.
export default class TestScreen extends AssetBrowser {
    constructor() {
        super({ key: "test-screen", active: true })
    }
}
