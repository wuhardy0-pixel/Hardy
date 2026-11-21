# green-screen cut-out: flood from the borders through green-ish pixels, soft edge, remove green spill, crop, 256px webp
import sys, os, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
src, dst = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
greenness = g - np.maximum(r, b)                      # how much greener than the other two
border = np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]])
ref = np.median(border, axis=0)                       # the background colour actually used (pure green, or a sage-grey some pictures came with)
dist = np.sqrt(((im - ref) ** 2).sum(-1))
bg = (greenness > 60) | (dist < 38)
lab, _ = ndimage.label(bg)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
mask = np.isin(lab, list(edge))
# also any big green islands (gaps between grapes, a bow's string, etc.)
sizes = ndimage.sum(bg, lab, range(lab.max() + 1))
mask |= np.isin(lab, [i for i, s in enumerate(sizes) if s > 400 and i])
alpha = np.where(mask, 0, 255).astype(np.uint8)
a = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
alpha = np.asarray(a).astype(np.float32)
# despill: where green leaks onto the object's edge, cap green at the larger of red/blue
g2 = np.minimum(g, np.maximum(r, b) + 10)
out = np.dstack([r, g2, b, alpha]).clip(0, 255).astype(np.uint8)
img = Image.fromarray(out, "RGBA")
bb = img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
img = img.crop(bb)
w, h = img.size; s = max(w, h); pad = int(s * .04)
sq = Image.new("RGBA", (s + 2 * pad, s + 2 * pad), (0, 0, 0, 0)); sq.paste(img, ((s - w) // 2 + pad, (s - h) // 2 + pad))
sq.resize((256, 256), Image.LANCZOS).save(dst, "WEBP", quality=88, method=6)
