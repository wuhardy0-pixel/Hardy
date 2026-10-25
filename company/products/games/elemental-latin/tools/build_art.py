"""Build the game's art from the two asset packs Hardy downloaded (2026-10-25):
  - "260 Elemental Character Portraits + Isometric Tiles.zip"  -> art/chars/*.webp (cut-out hero cards) + art/chars.json
                                                                 -> art/tiles/*_top.webp, *_side.webp (biome textures from the cube tiles)
Portraits that had a background were cut out with rembg (u2net) into a scratch folder first; the pack's own
"No Background Portraits" are preferred when they exist. Run from the game folder:
  python3 tools/build_art.py <unzipped pack folder> <folder of rembg cut-outs>
"""
import sys, os, glob, json
from PIL import Image

PACK, CUT = sys.argv[1], sys.argv[2]
CH = PACK + "/Elemental Characters"
NB = CH + "/No Background Portraits"
TI = PACK + "/Isometric Tiles/No Background Isometric Tiles"

# name -> (slug, element, preferred variant)
HEROES = {
 "Windy Wizard": ("windy-wizard", "air", 5), "Wind Lord": ("wind-lord", "air", 3), "Cloudy Orc Queen": ("orc-queen", "air", 3),
 "Archduke of the Aurora Borealis": ("archduke", "air", 1),
 "Fire Lord": ("fire-lord", "fire", 3), "Fire Dragon Duke": ("dragon-duke", "fire", 2), "Fiery Phoenix Pharaoh": ("phoenix-pharaoh", "fire", 1),
 "Master of the Volcanic Valley": ("volcano-master", "fire", 3),
 "Mystical Water Lady": ("water-lady", "water", 2), "Mermaid Knight of the Ocean": ("mermaid-knight", "water", 2),
 "Water Warrior of the Seas": ("water-warrior", "water", 1), "Silver Siren": ("silver-siren", "water", 2),
 "Dwarf Count of the Crystal Caves": ("dwarf-count", "earth", 2), "Stoneheart Duke in his rocky dominion": ("stoneheart", "earth", 1),
 "Desert Dragon Lord": ("desert-dragon", "earth", 1), "Duchess of the Desert Dunes": ("dune-duchess", "earth", 1),
 "Prince of Thunder": ("thunder-prince", "lightning", 1), "Lady of the Lighting Storm": ("storm-lady", "lightning", 2),
 "Ice Queen": ("ice-queen", "ice", 1), "Guardian of the Glaciers": ("glacier-guardian", "ice", 3),
 "Fairy Queen of the Frost Fields": ("frost-fairy", "ice", 1), "Vampire Princess of the Snow": ("snow-vampire", "ice", 1),
 "Emperor of the Flowers": ("flower-emperor", "light", 4), "Baron of the Blossoming Orchard": ("orchard-baron", "light", 4),
 "Fairy of the Forest": ("forest-fairy", "light", 5), "Forest Druid": ("forest-druid", "light", 3),
 "Knight of the Night Sky": ("night-knight", "shadow", 2), "Nebula Nymph": ("nebula-nymph", "shadow", 4),
 "Obsidian Elf King": ("obsidian-king", "shadow", 3), "Werewolf of the Petrified Forest": ("werewolf", "shadow", 4),
}

def find(name, variant):
    pats = [f"{name} ({variant}).png", f"{name}  ({variant}).png"]
    for folder in (NB, CUT):
        for p in pats:
            f = os.path.join(folder, p)
            if os.path.exists(f): return f
    cands = sorted(glob.glob(os.path.join(NB, name + "*.png"))) or sorted(glob.glob(os.path.join(CUT, name + "*.png")))
    return cands[0] if cands else None

def card(src, dst, size=512):
    im = Image.open(src).convert("RGBA")
    bb = im.getbbox(); im = im.crop(bb)
    w, h = im.size; side = int(max(w, h) * 1.04)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(im, ((side - w) // 2, side - h - int(side * .02)), im)   # bottom-aligned so feet/bust sit on the ground
    out = out.resize((size, size), Image.LANCZOS)
    out.save(dst, "WEBP", quality=84, method=6)
    return w / h

manifest = []
for name, (slug, el, var) in HEROES.items():
    src = find(name, var)
    if not src: print("MISSING", name); continue
    aspect = card(src, f"art/chars/{slug}.webp")
    manifest.append({"slug": slug, "name": name, "el": el, "file": f"art/chars/{slug}.webp", "aspect": round(aspect, 3)})
    print("card", slug, "<-", os.path.basename(src))
json.dump(manifest, open("art/chars.json", "w"), indent=1)

# biome tiles: letter -> file in the pack (chosen by eye from a contact sheet)
TILES = {"g": "Meteorite Fragment.png", "f": "Ancient Petrified Wood (2).png", "w": "Reflective Still Pond Surface (4).png",
         "m": "Air-weathered Mountain Peak (2).png", "v": "Lava Rock (4).png", "i": "Frosted Glacier Ice (2).png",
         "s": "Lunar Stone (3).png", "l": "Crystalline Salt Flat (1).png", "t": "Rain-Soaked City Brick (2).png",
         "a": "Polished Granite (2).png", "c": "Sun-Bleached Wood.png"}
N = 256
for k, fn in TILES.items():
    im = Image.open(os.path.join(TI, fn)).convert("RGBA")
    L, T, R, B = im.getbbox(); w, h = R - L, B - T; cx = L + w / 2
    # the cube's silhouette is a hexagon: top face = diamond, left face = parallelogram; unskew both to squares
    top = im.transform((N, N), Image.QUAD, (L, T + h / 4, cx, T + h / 2, R, T + h / 4, cx, T), Image.BICUBIC)
    side = im.transform((N, N), Image.QUAD, (L, T + h / 4, L, T + 3 * h / 4, cx, B, cx, T + h / 2), Image.BICUBIC)
    for nm, img in (("top", top), ("side", side)):
        bg = Image.new("RGB", (N, N), (30, 24, 40)); bg.paste(img, (0, 0), img)
        bg.save(f"art/tiles/{k}_{nm}.webp", "WEBP", quality=86, method=6)
    print("tile", k, "<-", fn)
