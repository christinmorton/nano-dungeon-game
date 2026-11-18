// Build the ability-icon spritesheet out of the 7Soul RPG icon pack.
//
// Every ability in v5 shipped with `icon = 31`, a Kenney tile — so all six HUD
// slots drew the same picture and the only thing distinguishing them was the
// hotkey letter beneath. This gives each of the eighteen its own 16x16 icon.
//
// WHY THIS PACK. It is 16x16 pixel art, which is the game's own grid and idiom.
// The other candidate on disk, skilliconpack, is 256x256 painted MMO-style
// artwork — good art, and a different visual language: downscaled to a 24px HUD
// slot it would read as smooth blobs beside crisp pixel tiles.
//
// LICENCE. 7Soul RPG Icon Pack 1, from the GameDev Market RPG Humble Bundle.
// "Important - Read Me.pdf" in the pack states the terms: GameDev Market Pro
// Licence, with the bundle's amendment removing the one-project restriction.
// Commercial use in a game is what it is for; redistributing the raw files is
// not, which the root .gitignore already enforces by extension. Same shape as
// the 32rogues terms. documents/v3_asset_licensing.md previously listed this
// pack as UNVERIFIED — that is now resolved and the doc says so.
//
// The OUTPUT is gitignored like all other art, so a clone regenerates it by
// running this script. What is worth keeping is the MAPPING below: which source
// file became which ability's icon, which is otherwise unrecoverable once
// eighteen files are flattened into one grid.
//
// Usage, from code/v5:  node scripts/build_skill_icons.mjs

import { existsSync, mkdirSync, rmSync, statSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, '..', '..', 'resources',
    '7soulsrpggraphics_iconpack_windows', '7soulsrpggraphics_iconpack', 'Pack 1A', 'skill')
const OUT_DIR = join(root, 'public', 'art')
const OUT = join(OUT_DIR, 'skills.png')

const TILE = 16     // native frame size of the pack, and of the emitted sheet
const COLS = 6      // 6 x 3 grid for eighteen abilities

// ABILITY -> source file, in FRAME ORDER. The index of a row here is the number
// that ability's `icon` field must carry, so REORDERING THIS BREAKS EVERY ICON.
// Append, don't insert.
//
// Grouped by class in kit order, each class's ultimate last, which is why the
// grid reads one class per row.
const MAPPING = [
    // — Warrior ————————————————————————————————————————————————
    ['Cleave', 'skill_alt_87.png'],     // a raking three-claw sweep
    ['Charge', 'skill_19.png'],         // a fist driving forward on speed lines
    ['Bulwark', 'skill_70.png'],        // plain braced shield
    ['MightyBlow', 'skill_61.png'],     // sword lit along the blade
    ['Shove', 'skill_191.png'],         // concentric force arcs
    ['TheReaving', 'skill_alt_148.png'],// a figure erupting — the berserker ult

    // — Ranger —————————————————————————————————————————————————
    ['Dash', 'skill_34.png'],           // motion curl
    ['PiercingLoose', 'skill_68.png'],  // an archer drawing a bow
    ['Root', 'skill_alt_112.png'],      // grasping vines
    ['Stealth', 'skill_75.png'],        // a figure dissolving into smoke
    ['Sense', 'skill_283.png'],         // an open eye. Nothing else came close.
    ['RainOfTalons', 'skill_67.png'],   // a volley of arrows

    // — Wizard —————————————————————————————————————————————————
    ['FrostBolt', 'skill_11.png'],      // icicle shards — the Rime Lance
    ['Barrier', 'skill_35.png'],        // a warding bubble around a figure
    ['ArcLightning', 'skill_15.png'],   // forked bolt
    ['Blink', 'skill_273.png'],         // spiral rift — Riftstep
    ['ManaBeam', 'skill_alt_122.png'],  // vertical energy column, violet to
                                        // match the ability's own ARCANE_TINT
    ['TheUnraveling', 'skill_alt_135.png'], // violet detonation
]

// ffmpeg lives behind the same resolver as the audio pipeline; see
// scripts/pick_audio.mjs for why PATH alone is not enough on Windows.
function resolveFfmpeg() {
    const candidates = []
    if (process.env.FFMPEG) candidates.push(process.env.FFMPEG)
    candidates.push('ffmpeg')
    const winget = join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages')
    try {
        for (const pkg of readdirSync(winget)) {
            if (!pkg.toLowerCase().includes('ffmpeg')) continue
            for (const build of readdirSync(join(winget, pkg))) {
                candidates.push(join(winget, pkg, build, 'bin', 'ffmpeg.exe'))
            }
        }
    } catch { /* not windows, or no winget */ }
    candidates.push('C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe')
    candidates.push('/usr/bin/ffmpeg')
    candidates.push('/opt/homebrew/bin/ffmpeg')
    for (const c of candidates) {
        try { execFileSync(c, ['-version'], { stdio: 'ignore' }); return c } catch { /* next */ }
    }
    return null
}

if (!existsSync(SRC)) {
    console.error(`No 7Soul icon pack at ${SRC}.`)
    console.error('The art packs are gitignored — restore them from your own copy first.')
    process.exit(1)
}

const ffmpeg = resolveFfmpeg()
if (!ffmpeg) {
    console.error('ffmpeg not found — needed to tile the icons into one sheet.')
    console.error('  Windows:  winget install Gyan.FFmpeg.Essentials')
    process.exit(1)
}

// Stage the chosen files under sequential names so ffmpeg's image2 demuxer can
// read them as one ordered sequence.
const stage = join(root, '.skillicons.tmp')
rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })
mkdirSync(OUT_DIR, { recursive: true })

const missing = []
MAPPING.forEach(([ability, file], i) => {
    const from = join(SRC, file)
    if (!existsSync(from)) { missing.push([ability, file]); return }
    // Transcode rather than copy. The pack mixes pixel formats (some frames are
    // RGBA, some paletted), and ffmpeg's image2 sequence demuxer STOPS at the
    // first format change — it does not error, it just yields the frames it read
    // so far, so the sheet silently comes out with two icons in it and the rest
    // black. Forcing every frame to rgba first is what makes the sequence
    // readable as one stream.
    execFileSync(ffmpeg, [
        '-y', '-loglevel', 'error',
        '-i', from,
        '-vf', `scale=${TILE}:${TILE}:flags=neighbor,format=rgba`,
        '-frames:v', '1',
        join(stage, `${String(i + 1).padStart(3, '0')}.png`),
    ])
})

if (missing.length) {
    console.error(`${missing.length} source icons not found:`)
    for (const [ability, file] of missing) console.error(`  ${ability}  <-  ${file}`)
    console.error('Refusing to build a sheet with holes — the frame indices would all shift.')
    rmSync(stage, { recursive: true, force: true })
    process.exit(1)
}

const rows = Math.ceil(MAPPING.length / COLS)
// padding/margin MUST stay 0: Phaser reads this back as a uniform 16px grid.
execFileSync(ffmpeg, [
    '-y', '-loglevel', 'error',
    '-framerate', '1',
    '-i', join(stage, '%03d.png'),
    '-frames:v', '1',
    '-filter_complex', `tile=${COLS}x${rows}:padding=0:margin=0`,
    OUT,
])
rmSync(stage, { recursive: true, force: true })

console.log(`Built ${OUT.replace(root, 'code/v5')} — ${MAPPING.length} icons, ${COLS}x${rows} grid of ${TILE}px frames`)
console.log(`${(statSync(OUT).size / 1024).toFixed(1)} kB`)
console.log('\nFrame indices (set these as each ability\'s `icon`):')
MAPPING.forEach(([ability], i) => {
    console.log(`  ${String(i).padStart(2)}  ${ability}`)
})
