"""The Lantern Company cover, story version: the Wizard fires Mana Beam into a pack
pouring through a doorway while the Warrior and Ranger hold the flanks.

Grid: 10 x 8 cells of 32px tiles at 2x = 640 x 512, cropped to 630 x 500.
Effects (beam, burst, arrow, motes) are drawn at SOURCE resolution and upscaled
with the rest so every effect pixel is the same size as an art pixel.
"""
import random, sys, math, os
from PIL import Image, ImageFilter, ImageChops, ImageDraw

V5 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
CAV = f"{V5}/game_dev_sprites/sprites/cavern"
COM = f"{V5}/game_dev_sprites/sprites/common"
H = f"{V5}/art/heroes/classes"
M = f"{V5}/art/monsters"
OUT = sys.argv[1] if len(sys.argv) > 1 else "story_draft.png"
SEED = int(sys.argv[2]) if len(sys.argv) > 2 else 11
random.seed(SEED)

K = 2
C = 32                      # source cell
COLS, ROWS = 10, 8
SW, SH = COLS * C, ROWS * C # source-res canvas 320 x 256

ARCANE = (0xb9, 0x8b, 0xff)  # game's magic tint (ARCANE_TINT / shockwave default)
WHITE = (255, 255, 255)

def sheet(p): return Image.open(p).convert("RGBA")
def frame(im, idx, cols, cell=32):
    x, y = (idx % cols) * cell, (idx // cols) * cell
    return im.crop((x, y, x + cell, y + cell))

ground = sheet(f"{CAV}/dirt_ground.png")
walls  = sheet(f"{CAV}/dungeon_walls.png")
props  = sheet(f"{CAV}/dungeon_props.png")
hollow = sheet(f"{CAV}/dungeon_hollows.png")
pillar = sheet(f"{CAV}/dungeon_pillars.png")
stairs = sheet(f"{CAV}/dungeon_stairs.png")
doors  = sheet(f"{COM}/dungeon_doors.png")
PROP = {n: i for i, n in enumerate([
    'rubble','slab','bones','crate','urn','brazier','calcite','cave_cap','dripstone',
    'rubble_disturbed','slab_toppled','bones_scattered','crate_smashed','urn_shattered',
    'brazier_cold','calcite_mined','cave_cap_picked','dripstone_broken'])}

# Everything is composed at SOURCE resolution, then upscaled once.
src = Image.new("RGBA", (SW, SH), (0, 0, 0, 255))
def put(im, cx, cy, dx=0, dy=0):
    src.alpha_composite(im, (int(cx * C + dx), int(cy * C + dy)))

# --- floor
for y in range(2, ROWS):
    for x in range(COLS):
        put(frame(ground, random.randrange(9), 3), x, y)

# --- pool, bottom-right (water autotile: bit set = open side; up1 right2 down4 left8)
for (x, y), mask in {(8, 6): 6, (9, 6): 12, (8, 7): 3, (9, 7): 9}.items():
    put(frame(hollow, 16 + mask, 8), x, y)

# --- top wall + the doorway the enemies are coming through
for x in range(COLS):
    put(frame(walls, 11 * 9 + 1 * 3 + (x % 3), 9), x, 0)
    put(frame(walls, 144 + (x % 3), 9), x, 1)
put(frame(doors, 0, 4), 8, 1)

# --- props
put(frame(props, PROP['brazier'], 9), 1, 2)
put(frame(props, PROP['brazier'], 9), 6, 2)
put(frame(stairs, 0, 2), 0, 7)                      # the party came down these
put(frame(props, PROP['urn'], 9), 0, 3)
put(frame(props, PROP['rubble'], 9), 2, 7)
put(frame(props, PROP['bones_scattered'], 9), 5, 7)
put(frame(props, PROP['calcite'], 9), 7, 7)
put(frame(props, PROP['crate_smashed'], 9), 9, 2)
put(frame(pillar, 0, 2), 0, 5)

# --- actors. 48px sprite centred on a 32px cell, feet at the cell's bottom edge.
def actor(path, cx, cy, dx=0, dy=0, flip=False):
    im = Image.open(path).convert("RGBA")
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    put(im, cx, cy, dx - 8, dy - 16)
    return (cx * C + dx - 8, cy * C + dy - 16)      # sprite top-left, source px

# threats
sk = actor(f"{M}/skeleton_south.png", 1, 4, dx=-8)   # left flanker, sword-range of the Warrior
actor(f"{M}/goblin_south.png", 8, 2, dy=2)           # stepping out of the doorway
orc = actor(f"{M}/orc_south.png", 7, 4)              # the one taking the beam
actor(f"{M}/ogre_south.png", 9, 3, dx=-12)
actor(f"{M}/goblin_archer_south.png", 9, 5, dx=-12)
actor(f"{M}/slime_south.png", 7, 6, dx=-6)
sp = actor(f"{M}/spider_south.png", 6, 7, dx=4, dy=-10)  # bottom flanker, on the Ranger

# party
actor(f"{H}/warrior_south.png", 2, 4, dx=4)          # holds the left
wiz = actor(f"{H}/wizard_south.png", 3, 5)           # centre, casting
rng = actor(f"{H}/ranger_south.png", 4, 6, dx=-6)    # holds the bottom

# --- effects layer (source res, RGBA)
fx = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
d = ImageDraw.Draw(fx)

# Mana Beam: from the staff tip to the orc's chest. Outer band, core, sparks.
x0, y0 = wiz[0] + 36, wiz[1] + 8
x1, y1 = orc[0] + 22, orc[1] + 26
d.line((x0, y0, x1, y1), fill=ARCANE + (150,), width=6)
d.line((x0, y0, x1, y1), fill=ARCANE + (255,), width=4)
d.line((x0, y0, x1, y1), fill=WHITE + (255,), width=2)
L = math.hypot(x1 - x0, y1 - y0)
for i in range(18):
    t = random.random(); s = random.choice((-4, -3, 3, 4))
    px = x0 + (x1 - x0) * t + s * (y0 - y1) / L
    py = y0 + (y1 - y0) * t + s * (x1 - x0) / L
    d.point((round(px), round(py)), fill=random.choice((ARCANE, WHITE)) + (255,))
# impact burst on the orc
for r, col in ((9, ARCANE + (120,)), (6, ARCANE + (255,)), (3, WHITE + (255,))):
    d.ellipse((x1 - r, y1 - r, x1 + r, y1 + r), fill=col)
for a in range(0, 360, 45):
    ex = x1 + round(13 * math.cos(math.radians(a))); ey = y1 + round(13 * math.sin(math.radians(a)))
    d.line((x1, y1, ex, ey), fill=ARCANE + (255,), width=1)
# charge motes around the staff
for i in range(10):
    a = random.random() * math.tau; r = 6 + random.random() * 9
    d.point((round(x0 + r * math.cos(a)), round(y0 + r * math.sin(a))), fill=random.choice((ARCANE, WHITE)) + (255,))
# Ranger's arrow, loosed at the spider
ax0, ay0 = rng[0] + 30, rng[1] + 24
ax1, ay1 = sp[0] + 22, sp[1] + 18
t0, t1 = 0.45, 0.75                                   # the arrow, mid-flight
sx, sy = ax0 + (ax1 - ax0) * t0, ay0 + (ay1 - ay0) * t0
ex, ey = ax0 + (ax1 - ax0) * t1, ay0 + (ay1 - ay0) * t1
d.line((sx, sy, ex, ey), fill=(0x8a, 0x6e, 0x4a, 255), width=1)       # shaft
d.line((sx, sy, sx + 2, sy - 2), fill=(0xcf, 0xc6, 0xb8, 255), width=1)  # fletching
d.point((round(ex), round(ey)), fill=WHITE + (255,))                    # head
d.point((round(ex) - 1, round(ey)), fill=(0xcf, 0xc6, 0xb8, 255))

src.alpha_composite(fx)

# --- upscale once
canvas = src.resize((SW * K, SH * K), Image.NEAREST)
scene = canvas.convert("RGB")
w, h = scene.size

# --- lighting as an RGB light map: warm brazier glows + cold arcane glow along the beam
def radial(cx, cy, radius, peak):
    g = Image.new("L", (w, h), 0); gd = ImageDraw.Draw(g)
    for i in range(radius, 0, -8):
        gd.ellipse((cx - i, cy - i, cx + i, cy + i), fill=int(peak * (1 - i / radius) ** 1.2))
    return g.filter(ImageFilter.GaussianBlur(24))
def tinted(mask, rgb):
    return Image.merge("RGB", tuple(mask.point(lambda v, c=c: v * c // 255) for c in rgb))

light = Image.new("RGB", (w, h), (0, 0, 0))
warm = (255, 205, 140)
light = ImageChops.add(light, tinted(radial(int(1.5 * C * K), int(2.6 * C * K), 260, 255), warm))
light = ImageChops.add(light, tinted(radial(int(6.5 * C * K), int(2.6 * C * K), 260, 255), warm))
light = ImageChops.add(light, tinted(radial(int(4.5 * C * K), int(5.2 * C * K), 380, 120), (255, 240, 220)))
beam_mask = Image.new("L", (w, h), 0)
ImageDraw.Draw(beam_mask).line((x0 * K, y0 * K, x1 * K, y1 * K), fill=255, width=70)
beam_mask = beam_mask.filter(ImageFilter.GaussianBlur(30))
light = ImageChops.add(light, tinted(beam_mask, (150, 110, 230)))
light = ImageChops.add(light, tinted(radial(x1 * K, y1 * K, 150, 255), ARCANE))
# ambient floor, then the darker top band for the wordmark
floor = Image.new("RGB", (w, h), (46, 44, 52))
light = ImageChops.add(light, floor)
ramp = Image.new("L", (w, h), 255); rd = ImageDraw.Draw(ramp)
for y in range(int(2.2 * C * K)):
    rd.line((0, y, w, y), fill=int(255 * (0.60 + 0.40 * y / (2.2 * C * K))))
light = ImageChops.multiply(light, Image.merge("RGB", (ramp, ramp, ramp)))
scene = ImageChops.multiply(scene, light)
# the effects themselves should not be darkened: re-composite them at full brightness
fx_up = fx.resize((SW * K, SH * K), Image.NEAREST)
scene = Image.composite(fx_up.convert("RGB"), scene, fx_up.split()[3])

scene = scene.crop(((w - 630) // 2, (h - 500) // 2, (w - 630) // 2 + 630, (h - 500) // 2 + 500))
scene.save(OUT)
print("wrote", OUT, scene.size)
