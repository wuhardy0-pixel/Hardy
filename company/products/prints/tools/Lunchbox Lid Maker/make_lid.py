#!/usr/bin/env python3
"""Step 1 of the Lunchbox Lid Maker: turn the customer's picture (+ name)
into a pixel map of Barbara's filament colors. Step 2 (bake_lid.py, run by
Blender) turns that map into geometry baked into the lid.

Reads:  Drop_Picture_Here/<newest image>, order.txt
Writes: Print These/<timestamp>/ -> indexed.png, palette.json, preview.png
"""
import json, os, sys, time, glob
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
DROP = os.path.join(HERE, "Drop_Picture_Here")
OUT_ROOT = os.path.join(HERE, "Print These")

PALETTE = {  # opaque shop colors (transparent can't show a picture)
    "White":  (245, 245, 245),
    "Black":  (43, 43, 46),
    "Purple": (124, 77, 188),
    "Blue":   (43, 108, 176),
    "Orange": (224, 112, 32),
    "Red":    (197, 48, 48),
}
# grid geometry (millimeters, 1 mm per pixel) — matches the website preview
GRID_W, GRID_H = 150, 130          # full canvas: x 52.4..202.4, y 41.25..171.25 on the lid
PIC = (20, 0, 130, 83)             # picture sub-rect (x0, y0, x1, y1) in grid px, top-centered
TEXT_BAND = (0, 88, 150, 128)      # name band below the picture

def read_order():
    cfg = {"NAME": "", "NAME_COLOR": "Black", "MAX_COLORS": "4"}
    p = os.path.join(HERE, "order.txt")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            if ":" in line and not line.strip().startswith("#"):
                k, v = line.split(":", 1)
                cfg[k.strip().upper()] = v.strip()
    return cfg

def newest_image():
    files = [f for f in glob.glob(os.path.join(DROP, "*"))
             if f.lower().endswith((".png", ".jpg", ".jpeg", ".heic", ".webp"))]
    if not files:
        sys.exit("No picture found. Put the customer's picture into 'Drop_Picture_Here' first.")
    return max(files, key=os.path.getmtime)

def nearest(c, pal):
    return min(pal, key=lambda n: sum((a - b) ** 2 for a, b in zip(c, pal[n])))

def main():
    cfg = read_order()
    max_colors = max(2, min(6, int(cfg.get("MAX_COLORS", "4") or 4)))
    src_path = newest_image()
    img = Image.open(src_path).convert("RGB")

    # fit picture into its sub-rect (contain, centered)
    pw, ph = PIC[2] - PIC[0], PIC[3] - PIC[1]
    s = min(pw / img.width, ph / img.height)
    small = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)

    grid = Image.new("RGB", (GRID_W, GRID_H), (0, 0, 0))
    used = Image.new("1", (GRID_W, GRID_H), 0)   # which pixels get an inlay
    ox = PIC[0] + (pw - small.width) // 2
    oy = PIC[1] + (ph - small.height) // 2
    grid.paste(small, (ox, oy))
    ImageDraw.Draw(used).rectangle([ox, oy, ox + small.width - 1, oy + small.height - 1], fill=1)

    # quantize picture pixels to the palette, limited to the most-used colors
    px, un = grid.load(), used.load()
    counts = {}
    for y in range(GRID_H):
        for x in range(GRID_W):
            if un[x, y]:
                n = nearest(px[x, y], PALETTE)
                counts[n] = counts.get(n, 0) + 1
    keep = sorted(counts, key=counts.get, reverse=True)[:max_colors]
    pal = {n: PALETTE[n] for n in keep}

    name = cfg.get("NAME", "").strip()[:30]
    name_color = cfg.get("NAME_COLOR", "Black").title()
    if name and name_color not in pal:
        pal[name_color] = PALETTE.get(name_color, PALETTE["Black"])

    names = list(pal)  # final color order; index in this list = pixel value
    for y in range(GRID_H):
        for x in range(GRID_W):
            if un[x, y]:
                px[x, y] = pal[nearest(px[x, y], pal)]

    # draw the name into the band (its pixels join the inlay too)
    if name:
        band_w = TEXT_BAND[2] - TEXT_BAND[0]
        band_h = TEXT_BAND[3] - TEXT_BAND[1]
        font = None
        for fp in ["/System/Library/Fonts/Supplemental/Futura.ttc",
                   "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf",
                   "/System/Library/Fonts/Supplemental/Arial Bold.ttf"]:
            if os.path.exists(fp):
                try:
                    font = ImageFont.truetype(fp, band_h - 4)
                    break
                except Exception:
                    pass
        font = font or ImageFont.load_default()
        d = ImageDraw.Draw(grid)
        while True:
            box = d.textbbox((0, 0), name, font=font)
            if box[2] - box[0] <= band_w - 4 or getattr(font, "size", 0) <= 8:
                break
            font = ImageFont.truetype(font.path, font.size - 2)
        tx = TEXT_BAND[0] + (band_w - (box[2] - box[0])) // 2 - box[0]
        ty = TEXT_BAND[1] + (band_h - (box[3] - box[1])) // 2 - box[1]
        mask = Image.new("1", (GRID_W, GRID_H), 0)
        ImageDraw.Draw(mask).text((tx, ty), name, font=font, fill=1)
        mk = mask.load()
        for y in range(GRID_H):
            for x in range(GRID_W):
                if mk[x, y]:
                    px[x, y] = pal[name_color]
                    un[x, y] = 1

    # outputs
    job = os.path.join(OUT_ROOT, time.strftime("%Y-%m-%d_%H.%M") + (("_" + name) if name else ""))
    os.makedirs(job, exist_ok=True)
    idx = Image.new("L", (GRID_W, GRID_H), 255)  # 255 = no inlay
    ix = idx.load()
    for y in range(GRID_H):
        for x in range(GRID_W):
            if un[x, y]:
                ix[x, y] = names.index(nearest(px[x, y], pal))
    idx.save(os.path.join(job, "indexed.png"))
    json.dump({"names": names, "rgb": [pal[n] for n in names],
               "grid_mm": [GRID_W, GRID_H], "origin_mm": [52.4, 171.25]},
              open(os.path.join(job, "palette.json"), "w"))
    big = grid.resize((GRID_W * 6, GRID_H * 6), Image.NEAREST)
    big.save(os.path.join(job, "preview.png"))
    open(os.path.join(HERE, ".last_job"), "w").write(job)
    print(f"Colors used: {', '.join(names)}")
    print(f"Job folder: {job}")

if __name__ == "__main__":
    main()
