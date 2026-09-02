// Build data/products.json + public/products/* from ../assets/products/*/info.md
import { readFileSync, readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// web-optimized copies: photos → webp (big win: renders are 1-2 MB PNGs)
const toWebp = (src, dest, width) =>
  sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(dest);
const toSmallPng = (src, dest, width) =>
  sharp(src).resize({ width, withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(dest);

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(APP, "..", "assets", "products");
const OUT_DATA = join(APP, "data");
const OUT_IMG = join(APP, "public", "products");

const field = (md, label) => {
  const m = md.match(new RegExp(`\\*\\*${label}[^*]*\\*\\*\\s*(.+)`, "i"));
  return m ? m[1].trim() : "";
};
const yesDetail = (v) => {
  if (!/^yes/i.test(v)) return null;
  const detail = v.replace(/^yes\s*[—-]?\s*/i, "").trim();
  return { detail: detail || "", required: /required/i.test(detail) };
};

const shopInfo = readFileSync(join(SRC, "shop-info.md"), "utf8");
const colorSection = shopInfo.split(/## My filament colors/i)[1]?.split(/\n## /)[0] ?? "";
const COLOR_HEX = {
  purple: "#7c4dbc", white: "#f5f5f5", black: "#2b2b2e",
  blue: "#2b6cb0", orange: "#e07020", red: "#c53030",
  green: "#2e7d46", yellow: "#e0b420", gray: "#8a9096", grey: "#8a9096", pink: "#d76fa3",
  transparent: "#e2ebee",
};
const colors = [...colorSection.matchAll(/^- (.+)$/gm)]
  .map((m) => m[1].trim())
  .filter((c) => !/example/i.test(c))
  .map((name) => ({
    name,
    hex: COLOR_HEX[name.toLowerCase().split(/[\s(]/)[0]] || "#9aa0a6",
    transparent: /transparent|clear/i.test(name) || undefined,
  }));
const about = (shopInfo.split(/## About the shop[^\n]*\n/i)[1] ?? "")
  .split(/\n\(Barbara|\n## /)[0].trim();

import { rmSync } from "node:fs";
rmSync(OUT_IMG, { recursive: true, force: true }); // drop stale uncompressed copies

const products = [];
for (const slug of readdirSync(SRC).sort()) {
  const dir = join(SRC, slug);
  if (!statSync(dir).isDirectory()) continue;
  const md = readFileSync(join(dir, "info.md"), "utf8");
  if (!/^yes/i.test(field(md, "Sell this"))) continue;

  const price = Number((field(md, "Price").match(/\d+(\.\d+)?/) || [0])[0]);
  const photos = field(md, "Photos").split(",").map((p) => p.trim()).filter((p) => /\.(png|jpe?g)$/i.test(p));
  if (!price || photos.length === 0) { console.warn(`skip ${slug}: missing price/photos`); continue; }

  mkdirSync(join(OUT_IMG, slug), { recursive: true });
  const webPhotos = [];
  for (const p of photos) {
    const out = p.replace(/\.(png|jpe?g)$/i, ".webp");
    await toWebp(join(dir, p), join(OUT_IMG, slug, out), 1000);
    webPhotos.push(out);
  }

  // interactive preview assets v2: turntable frames + per-zone masks + areas
  let preview = null;
  const pvDir = join(dir, "preview");
  if (existsSync(join(pvDir, "preview.json"))) {
    const pv = JSON.parse(readFileSync(join(pvDir, "preview.json"), "utf8"));
    const pvOut = join(OUT_IMG, slug, "preview");
    mkdirSync(join(pvOut, "frames"), { recursive: true });
    const frames = [];
    for (const fr of pv.frames) {
      const baseOut = fr.base.replace(/\.png$/, ".webp");
      await toWebp(join(pvDir, fr.base), join(pvOut, baseOut), 1000);
      const masks = {};
      for (const [zone, mf] of Object.entries(fr.masks)) {
        await toSmallPng(join(pvDir, mf), join(pvOut, mf), 700);
        masks[zone] = `/products/${slug}/preview/${mf}`;
      }
      frames.push({ ...fr, base: `/products/${slug}/preview/${baseOut}`, masks });
    }
    preview = { ...pv, frames };
  }

  products.push({
    slug,
    name: md.match(/^# (.+)$/m)[1].trim(),
    price,
    multicolored: /^yes/i.test(field(md, "Multicolored")),
    text: yesDetail(field(md, "Custom text")),
    image: yesDetail(field(md, "Customer image upload")),
    description: field(md, "Short description"),
    photos: webPhotos.map((p) => `/products/${slug}/${p}`),
    zones: preview?.zones ?? ["Color"],
    preview,
  });
}

mkdirSync(OUT_DATA, { recursive: true });
writeFileSync(join(OUT_DATA, "catalog.json"), JSON.stringify({
  shopName: "Hardy's 3D",
  about,
  currency: "usd",
  shippingCents: 500,
  colors,
  products,
}, null, 2));
console.log(`catalog: ${products.length} products, ${colors.length} colors`);
