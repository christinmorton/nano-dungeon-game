import { defineConfig } from 'vite'

// Build config for the published game. Both settings exist for the same reason:
// v5 ships to itch.io, which serves a game from a generated subdirectory rather
// than from a domain root.
//
// base: './'
//   Vite's default base is '/', which emits <script src="/assets/index-<hash>.js">
//   — an absolute path. On itch that resolves to the domain root, not the game's
//   folder, so the page loads and the bundle 404s: a black screen with no visible
//   error. Relative base makes the build portable to any subdirectory, which also
//   means `dist/` can be opened from disk or zipped and dropped anywhere.
//
// build.assetsDir: 'bundle'
//   Vite writes hashed JS/CSS into dist/<assetsDir>/, which defaults to 'assets'.
//   public/assets/ ALSO copies verbatim to dist/assets/ (it holds fonts/arcade.*,
//   preloaded by World.js). Both would land in one directory. Nothing collides by
//   filename today, but the two are unrelated and one is generated — renaming the
//   generated half keeps public/ mirrored 1:1 into dist/ and leaves the font path
//   in World.js untouched.
export default defineConfig({
    base: './',
    build: {
        assetsDir: 'bundle',
    },
})
