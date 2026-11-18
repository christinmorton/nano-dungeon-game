// Pick the game's sound set out of the purchased audio libraries.
//
// The repo-root resources/ folder holds the unzipped purchased libraries
// (~18 of them, tens of GB). The game needs about seventy files. This copies
// just those into public/audio/ under game-event names, so code can say
// `sfx.play('ability-blink')` instead of reaching into
// "rpgmagicsfxpack2/RPG Magic SFX 2/DucVu_Spells_SFX_[...]".
//
// The libraries lived in code/v5/public/assets/ until 2026-09-10 and were moved
// out to resources/ because Vite copies public/ verbatim into the build — the
// dist/ folder was 6.6 GB, almost all of it source audio the game never loads.
// Keep raw libraries OUT of public/ for that reason.
//
// The libraries are gitignored (unverified redistribution terms, and they are
// enormous), so this only runs where they are on disk. The MAPPING below is
// the part worth keeping: it records which source file each game sound came
// from, which is otherwise unrecoverable once the files are renamed.
//
// Usage, from code/v5:  node scripts/pick_audio.mjs
//
// SOURCE PREFERENCE. The RPG-specific packs (RPG Magic SFX 2, the two music
// packs, the footstep pack) are purpose-built game audio: 44.1kHz/16-bit,
// short, dry, and named by intent. The cinematic libraries (Whooshes, Risers,
// Combat & Warfare) are 96kHz/24-bit trailer sound — used only where the RPG
// packs have no equivalent, which in practice means bows and monster throats.

import { mkdirSync, existsSync, statSync, writeFileSync, readdirSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// resources/ sits at the REPO root, two levels above code/v5.
const SRC = join(root, '..', '..', 'resources')
const OUT = join(root, 'public', 'audio')
// Generated index of what the game loads. Committed (unlike the audio itself)
// so a fresh clone still builds and runs — it just plays silent, the same way
// a clone without the art packs renders untextured.
const MANIFEST = join(root, 'src', 'data', 'audioManifest.json')

// ── ENCODING ───────────────────────────────────────────────────────────────
// Everything ships as OGG Vorbis. The first pass copied source files verbatim,
// which put 50 MB in public/audio/ — 26 MB of it uncompressed WAV — and audio
// was then 91% of the whole build. These are short one-shots and looping
// background music, not an album, so the bitrate the libraries ship at (the
// music masters are 384-432 kbps) buys nothing a player can hear through a
// dungeon crawl.
//
// -q:a 3 is roughly 112 kbps and -q:a 4 roughly 128 kbps at stereo. Both are
// well clear of artifact territory for this material. Sample rates are pinned
// so the 96 kHz cinematic sources stop spending bits on inaudible headroom.
//
// Music encodes from the packs' WAV masters (see STEPS/MUSIC/BATTLE above), so
// this is one lossy generation, not two.
const ENCODING = {
    sfx: ['-c:a', 'libvorbis', '-q:a', '3', '-ar', '44100'],
    music: ['-c:a', 'libvorbis', '-q:a', '4', '-ar', '48000'],
}

// Music profile for the looping tracks and the musical stings. Footsteps are
// one-shots and take the sfx profile despite coming from a music-pack folder.
const isMusic = (event) => event.startsWith('music-') || event.startsWith('fanfare-')

// Find ffmpeg. PATH first, but winget's Gyan.FFmpeg package installs into a
// versioned build directory and an already-open shell won't have picked it up,
// so that layout is probed directly rather than making this fail on a machine
// where ffmpeg is genuinely installed. Set FFMPEG=<path> to override.
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
    } catch { /* no winget packages dir — fine */ }

    candidates.push('C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe')
    candidates.push('/usr/bin/ffmpeg')
    candidates.push('/opt/homebrew/bin/ffmpeg')

    for (const candidate of candidates) {
        try {
            execFileSync(candidate, ['-version'], { stdio: 'ignore' })
            return candidate
        } catch { /* not this one */ }
    }
    return null
}

// Every pack nests a folder of the same name inside itself; these prefixes
// absorb that so the mapping below stays readable.
const MAGIC = 'rpgmagicsfxpack2/RPG Magic SFX 2'
const ELEM = 'Complete Elements Sound FX/Complete Elements Sound FX'
const NATURE = 'Beautiful Nature Sound FX/Beautiful Nature Sound FX'
const COMBAT = 'Combat & Warfare Sound FX/Combat & Warfare Sound FX'
const WHOOSH = 'Ultimate Whooshes Sound FX/Ultimate Whooshes Sound FX'
// These three packs ship OGG *and* WAV of every track. Take the WAV: everything
// here is re-encoded on the way out (see ENCODING below), and encoding from the
// lossless master beats re-compressing the pack's own 400+ kbps OGG.
const STEPS = 'footstepssounds/Footsteps Sounds/WAV'
const MUSIC = 'fantasy_rpgmusicpack/RPG_Fantasy_Music_Pack/WAV'
const BATTLE = 'rpgbattlethemes/RPG Battle Themes/WAV'

// game event -> source file. Durations are noted because these libraries mix
// one-shots with multi-take files: UI_Button_Select is 7.8s, which is not a
// button click, so UI_Menu_Select is used instead.
const MAPPING = [
    // — Melee ————————————————————————————————————————————————————
    ['melee-swing', `${MAGIC}/Basic_Magic_Attacks_Impacts/Sword_Slash_1_v1.wav`, 0.73],
    ['melee-swing-alt', `${MAGIC}/Basic_Magic_Attacks_Impacts/Sword_Slash_1_v2.wav`, null],
    ['melee-hit', `${MAGIC}/Basic_Magic_Attacks_Impacts/Attack_Enemy_Impact_1.wav`, 0.40],
    ['melee-hit-heavy', `${MAGIC}/Basic_Magic_Attacks_Impacts/Attack_Enemy_Impact_5_heavy.wav`, null],
    ['melee-hit-light', `${MAGIC}/Basic_Magic_Attacks_Impacts/Light_Enemy_Impact_1.wav`, null],
    ['melee-crit', `${MAGIC}/Basic_Magic_Attacks_Impacts/Impact_Finishing_Blow.wav`, 1.87],
    ['melee-miss', `${MAGIC}/Basic Whooshes/Subtle_Slash_1.wav`, null],
    ['weapon-draw', `${COMBAT}/Swords/Take Out Sword.wav`, 2.82],

    // — Ranged. No bow anywhere in the RPG packs, so these stay cinematic —
    //   and they are among the shortest files in that library anyway.
    ['bow-draw', `${COMBAT}/Bows/Bowstring.wav`, null],
    ['bow-shot', `${COMBAT}/Bows/Bow Shooting Arrow.wav`, 0.34],
    ['arrow-hit', `${COMBAT}/Bows/Arrow Hit.wav`, 0.30],
    ['arrow-hit-flesh', `${COMBAT}/Bows/Arrow Hitting Flesh.wav`, 0.45],

    // — The twelve abilities, by name ————————————————————————————
    ['ability-arclightning', `${MAGIC}/Elemental_Magic_Layers_Impacts/Electric_Spell_Generic_Whoosh_v1.wav`, null],
    ['ability-arclightning-hit', `${MAGIC}/Elemental_Magic_Layers_Impacts/Electric_Spell_Generic_Simple_Impact_v1.wav`, 0.41],
    ['ability-barrier', `${MAGIC}/Short Spells/S1_Subtle_Shield_1.wav`, 0.59],
    ['ability-blink', `${MAGIC}/DucVu_Spells_SFX_[Video_Demo_1]/Teleport_Side_Step.wav`, 2.45],
    ['ability-bulwark', `${MAGIC}/Short Spells/S6_Buff_1.wav`, null],
    ['ability-charge', `${MAGIC}/DucVu_Spells_SFX_[Video_Demo_1]/Ground_Breaking_Strike_Jump_Swoosh.wav`, null],
    ['ability-cleave', `${MAGIC}/Basic_Magic_Attacks_Impacts/Sword_Slash_1_v3.wav`, null],
    ['ability-dash', `${MAGIC}/Elemental_Magic_Layers_Impacts/Wind_Whoosh_1.wav`, null],
    ['ability-frostbolt', `${MAGIC}/DucVu_Spells_SFX_[Video_Demo_1]/Babylon_Ice_Swords_Cast.wav`, null],
    ['ability-frostbolt-hit', `${MAGIC}/Elemental_Magic_Layers_Impacts/Water_Impact_Light_v1.wav`, null],
    ['ability-mightyblow', `${MAGIC}/Basic_Magic_Attacks_Impacts/Sword_Slash_1_Finishing_Blow.wav`, null],
    ['ability-piercingshot', `${COMBAT}/Bows/Hard Bow Shot.wav`, null],
    ['ability-root', `${MAGIC}/Elemental_Magic_Layers_Impacts/Plant_Spell_Grow_1_v1.wav`, null],
    ['ability-stealth', `${WHOOSH}/Granular Cloak Whoosh.wav`, null],
    // The fifth kit ability per class (scope doc §10.6). Sense and Shove are
    // one-shots; Mana Beam is keyed to its WIND-UP rather than its release,
    // because the audio hook fires on activation and this is the one ability
    // that spends most of its life charging.
    ['ability-sense', `${MAGIC}/Short Spells/S6_Buff_2.wav`, 0.80],
    ['ability-shove', `${MAGIC}/Short Spells/S6_Impact_1_v1.wav`, 0.85],
    ['ability-manabeam', `${MAGIC}/Long Spells/S2_Medium_Cast_v1.wav`, 2.87],

    // — The three ultimates. Bigger, longer sounds than the kit abilities on
    //   purpose: a twelve-turn cooldown should announce itself.
    ['ability-reaving', `${MAGIC}/Basic_Magic_Attacks_Impacts/Mech_Attack_1_Combo_FULL_Heavy_End.wav`, null],
    ['ability-raintalons', `${MAGIC}/Elemental_Magic_Layers_Impacts/Electric_Rain_Spell_FULL.wav`, null],
    ['ability-unraveling', `${MAGIC}/DucVu_Spells_SFX_[Video_Demo_1]/Plasma_Gravity_Strike_FULL.wav`, null],

    // — Generic spell beats, for abilities that want a windup or a debuff —
    ['cast', `${MAGIC}/Short Spells/S1_Small_Cast_P1.wav`, 1.19],
    ['cast-charge', `${MAGIC}/Short Spells/S6_Charge_Spell_1.wav`, null],
    ['buff', `${MAGIC}/Short Spells/S1_Small_End_P3_Buff_1.wav`, null],
    ['debuff', `${MAGIC}/Short Spells/S6_Debuff_1.wav`, 1.06],
    ['heal', `${MAGIC}/Short Spells/S6_Heal_1.wav`, 1.73],
    ['spell-fire', `${ELEM}/Fire/Magic Fire Spells/Fire Magic Spell Fast.wav`, null],
    ['spell-fire-impact', `${MAGIC}/Elemental_Magic_Layers_Impacts/Fireball_Basic_Impact.wav`, 1.23],
    ['spell-impact-generic', `${MAGIC}/Basic_Magic_Attacks_Impacts/Small_Magic_Impact_1.wav`, null],

    // — Enemies. The Creatures folder of the elements pack is the monster
    //   voice bank; the Animals pack is farm and wildlife, so it is not used.
    ['enemy-bat', `${MAGIC}/Basic_Magic_Attacks_Impacts/Wing_Impact_1.wav`, 0.63],
    ['enemy-ghost', `${ELEM}/Creatures/Airy Breath Creature.wav`, null],
    ['enemy-goblin', `${ELEM}/Creatures/Weird Creature.wav`, null],
    ['enemy-ogre', `${ELEM}/Creatures/Deep Roar.wav`, null],
    ['enemy-orc', `${ELEM}/Creatures/Aggresive Creature.wav`, null],
    ['enemy-scorpion', `${ELEM}/Creatures/Strange Insect Dribble.wav`, null],
    ['enemy-spider', `${ELEM}/Creatures/Fly By Insect.wav`, null],
    // Slime and skeleton were the two weakest picks in the first pass and are
    // replaced here. Slime is now a real wet collapse rather than a light water
    // tick. Skeleton is still a substitute — no pack in the collection contains
    // a bone sound of any kind — but dry, sharp ice cracks read as snapping
    // bone far better than a dirt impact did.
    ['enemy-slime', `${ELEM}/Liquids/Deep Liquid Splash.wav`, 1.00],
    ['enemy-skeleton', `${NATURE}/Ice/Small Ice Cracks.wav`, 2.07],
    ['enemy-sorcerer', `${MAGIC}/Long Spells/S2_Small_End_Evil.wav`, null],
    ['enemy-death', `${MAGIC}/Basic_Magic_Attacks_Impacts/Small_Impact_1.wav`, null],
    ['boss-death', `${MAGIC}/Misc/Epic_Boss_Death_P1P2.wav`, 7.81],

    // — Items and UI ——————————————————————————————————————————————
    ['potion-health', `${MAGIC}/Misc/HP_potion.wav`, 1.12],
    ['potion-stamina', `${MAGIC}/Misc/MP_Potion.wav`, 1.34],
    ['pickup', `${MAGIC}/Misc/UI_Get_Item.wav`, 0.51],
    ['ui-select', `${MAGIC}/Misc/UI_Menu_Select.wav`, 2.08],
    ['ui-error', `${MAGIC}/Misc/UI_Error.wav`, 0.35],
    ['ui-skill', `${MAGIC}/Misc/UI_Skill_Trigger_1.wav`, 0.50],
    ['turn-start', `${MAGIC}/Misc/UI_Player_Turn.wav`, 1.17],

    // — Footsteps. Already OGG and ~10 KB each; four variants so repeated
    //   steps can be randomised instead of machine-gunning one sample.
    ['step-stone-1', `${STEPS}/Footsteps_Casual_Stone_01.wav`, null],
    ['step-stone-2', `${STEPS}/Footsteps_Casual_Stone_02.wav`, null],
    ['step-stone-3', `${STEPS}/Footsteps_Casual_Stone_03.wav`, null],
    ['step-stone-4', `${STEPS}/Footsteps_Casual_Stone_04.wav`, null],

    // — Music and fanfares. Already OGG, so these ship as-is. The three
    //   exploration loops give the floors distinct moods; the battle loop is
    //   the stronghold's.
    ['music-floor-1', `${MUSIC}/Exploration_Cave (loop).wav`, null],
    ['music-floor-2', `${MUSIC}/Exploration_Dark (loop).wav`, null],
    ['music-floor-3', `${MUSIC}/Exploration_Mystery (loop).wav`, null],
    ['music-stronghold', `${MUSIC}/Battle_2_Evil (loop).wav`, null],
    ['fanfare-victory', `${BATTLE}/Fanfares_Win_01.wav`, null],
    ['fanfare-amulet', `${BATTLE}/Fanfares_BigWin.wav`, null],
    ['fanfare-defeat', `${BATTLE}/Fanfares_GameOver_01.wav`, null],
]

if (!existsSync(SRC)) {
    console.error(`No sound libraries at ${SRC}.`)
    console.error('They are gitignored — restore them from your own copy first.')
    process.exit(1)
}

const ffmpeg = resolveFfmpeg()
if (!ffmpeg) {
    console.error('ffmpeg not found. Everything here is re-encoded to OGG, so it is required.')
    console.error('  Windows:  winget install Gyan.FFmpeg.Essentials')
    console.error('  Or point at an existing install:  FFMPEG=/path/to/ffmpeg node scripts/pick_audio.mjs')
    process.exit(1)
}

mkdirSync(OUT, { recursive: true })

// Clear previously generated audio first. Without this, a run that changes a
// source format leaves the old file behind — public/audio/ would hold both
// melee-swing.wav and melee-swing.ogg, and the stale one still ships in the
// build even though the manifest no longer names it.
const AUDIO_EXT = /\.(ogg|wav|mp3|flac|aiff?|m4a)$/i
let cleared = 0
for (const name of readdirSync(OUT)) {
    if (!AUDIO_EXT.test(name)) continue
    unlinkSync(join(OUT, name))
    cleared++
}

let copied = 0
let bytes = 0
let sourceBytes = 0
const missing = []
const failed = []
const manifest = {}

for (const [event, relative] of MAPPING) {
    const from = join(SRC, relative)
    if (!existsSync(from)) {
        missing.push([event, relative])
        continue
    }
    const file = `${event}.ogg`
    const to = join(OUT, file)
    const args = ['-y', '-loglevel', 'error', '-i', from, ...ENCODING[isMusic(event) ? 'music' : 'sfx'], to]
    try {
        execFileSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    } catch (err) {
        const detail = String(err.stderr || err.message).trim().split('\n')[0]
        failed.push([event, detail])
        continue
    }
    sourceBytes += statSync(from).size
    bytes += statSync(to).size
    manifest[event] = file
    copied++
}

// The manifest lists only what was actually copied, so a partial run cannot
// leave the game trying to load a file that was never produced.
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 4) + '\n')

const mb = (n) => (n / 1048576).toFixed(1)
console.log(`Encoded ${copied}/${MAPPING.length} sounds to public/audio/ (cleared ${cleared} old files)`)
console.log(`Sources ${mb(sourceBytes)} MB  ->  output ${mb(bytes)} MB` +
    (sourceBytes ? `  (${(100 - (bytes / sourceBytes) * 100).toFixed(0)}% smaller)` : ''))
console.log(`Wrote src/data/audioManifest.json (${Object.keys(manifest).length} keys)`)

if (missing.length) {
    console.log(`\n${missing.length} not found — check the name against the pack:`)
    for (const [event, relative] of missing) console.log(`  ${event}  <-  ${relative}`)
    process.exitCode = 1
}

if (failed.length) {
    console.log(`\n${failed.length} failed to encode:`)
    for (const [event, detail] of failed) console.log(`  ${event}  ${detail}`)
    process.exitCode = 1
}
