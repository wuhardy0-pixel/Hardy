"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cart, money } from "../lib/cart";
import Stars from "./Stars";

const MAX_TEXT = 30;
const MAX_UPLOAD_MB = 10;
const OK_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"];
const ADDON_DEFAULT = { text: 2, image: 2, extraColor: 2 }; // dollars; the catalog's `addons` overrides
const PL0 = { img: { x: 0, y: 0, s: 1 }, text: { x: 0, y: 0, s: 1 } };   // where the picture and the name sit: offsets as a fraction of the printable area, and a size

/* ---------- interactive preview canvas ---------- */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// white-on-black mask -> canvas whose alpha = mask luminance
function maskToAlpha(img, W, H) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H);
  const a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    a[i + 3] = a[i]; a[i] = 255; a[i + 1] = 255; a[i + 2] = 255;
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

function quadTransform(ctx, area, W, H, natW, natH) {
  // affine map from a natW x natH source onto the area parallelogram (tl,tr,bl)
  const { tl, tr, bl } = area;
  ctx.setTransform(
    (tr[0] - tl[0]) / natW, (tr[1] - tl[1]) / natW,
    (bl[0] - tl[0]) / natH, (bl[1] - tl[1]) / natH,
    tl[0], tl[1]
  );
}

// show the customer's picture as it will PRINT: simplified to the shop's
// opaque filament colors, chunky pixels and all
function posterize(img, palette) {
  const w = Math.min(140, img.width);
  const h = Math.max(1, Math.round((img.height * w) / img.width));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h);
  const pal = palette.filter((p) => !p.transparent).map((p) => {
    const n = parseInt(p.hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
  const a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    let best = 0, bd = Infinity;
    for (let j = 0; j < pal.length; j++) {
      const dr = a[i] - pal[j][0], dg = a[i + 1] - pal[j][1], db = a[i + 2] - pal[j][2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bd) { bd = dist; best = j; }
    }
    a[i] = pal[best][0]; a[i + 1] = pal[best][1]; a[i + 2] = pal[best][2];
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

function PreviewCanvas({ preview, zoneColors, hexOf, uploadUrl, text, textColorHex, palette, placement, onPlace }) {
  const canvasRef = useRef(null);
  const drawnRef = useRef({});   // where the picture and the name were last drawn (natural units) for hit-testing
  const pl = placement || PL0;
  const cacheRef = useRef(new Map()); // frame index -> {baseImg, maskAlphas}
  const dragRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [side, setSide] = useState("front");
  const [spin, setSpin] = useState(0); // index within the current side
  const [uploadImg, setUploadImg] = useState(null);

  const frames = preview.frames;
  const sideIdxs = useMemo(() => {
    const m = { front: [], back: [] };
    frames.forEach((f, i) => (m[f.side] || (m[f.side] = [])).push(i));
    return m;
  }, [frames]);
  const hasBack = (sideIdxs.back || []).length > 0;
  const cur = sideIdxs[side][((spin % sideIdxs[side].length) + sideIdxs[side].length) % sideIdxs[side].length];
  // once there is a picture or a name, show the side that carries them
  useEffect(() => { if (!(uploadUrl || text)) return; const f = frames[cur]; if (f.imageArea || f.textArea) return; const other = side === "front" ? "back" : "front";
    if ((sideIdxs[other] || []).some((i) => frames[i].imageArea || frames[i].textArea)) { setSide(other); setSpin(0); } }, [uploadUrl, text]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFrame = async (i) => {
    if (cacheRef.current.has(i)) return cacheRef.current.get(i);
    const [W, H] = preview.res;
    const fr = frames[i];
    const p = (async () => {
      const baseImg = await loadImage(fr.base);
      const maskAlphas = {};
      for (const [zone, src] of Object.entries(fr.masks)) {
        maskAlphas[zone] = maskToAlpha(await loadImage(src), W, H);
      }
      return { baseImg, maskAlphas };
    })();
    cacheRef.current.set(i, p);
    return p;
  };

  // load the first frame fast, then prefetch the rest in the background
  useEffect(() => {
    let alive = true;
    (async () => {
      await loadFrame(sideIdxs.front[0]);
      if (alive) setReady(true);
      for (const i of [...(sideIdxs.front || []), ...(sideIdxs.back || [])]) {
        if (!alive) break;
        await loadFrame(i);
      }
    })();
    return () => { alive = false; };
  }, [preview]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!uploadUrl) { setUploadImg(null); return; }
    let alive = true;
    loadImage(uploadUrl).then((img) => { if (alive) setUploadImg(posterize(img, palette)); }).catch(() => {});
    return () => { alive = false; };
  }, [uploadUrl, palette]);

  useEffect(() => {
    if (!ready || !canvasRef.current) return;
    let stale = false;
    (async () => {
      const assets = await loadFrame(cur);
      if (stale || !canvasRef.current) return;
      const fr = frames[cur];
      const [W, H] = preview.res;
      const canvas = canvasRef.current;
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(assets.baseImg, 0, 0, W, H);

      for (const zone of preview.zones) {
        const mask = assets.maskAlphas[zone];
        const hex = hexOf(zoneColors[zone]);
        if (!mask || !hex) continue;
        const off = document.createElement("canvas");
        off.width = W; off.height = H;
        const octx = off.getContext("2d");
        octx.drawImage(mask, 0, 0);
        octx.globalCompositeOperation = "source-in";
        octx.fillStyle = hex;
        octx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "multiply";
        ctx.drawImage(off, 0, 0);
        ctx.globalCompositeOperation = "source-over";
      }

      drawnRef.current = {};
      if (fr.imageArea && uploadImg) {
        // natural units match the area's real-world proportions: no distortion
        const natW = 100, natH = 100 / (fr.imageArea.aspect || 4 / 3);
        const s = Math.min(natW / uploadImg.width, natH / uploadImg.height) * pl.img.s;
        const w = uploadImg.width * s, h = uploadImg.height * s;
        const x0 = (natW - w) / 2 + pl.img.x * natW / 2, y0 = (natH - h) / 2 + pl.img.y * natH / 2;
        quadTransform(ctx, fr.imageArea, W, H, natW, natH);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, natW, natH); ctx.clip();   // only the printable area prints
        ctx.globalAlpha = 0.96;
        ctx.imageSmoothingEnabled = false; // crisp printed-pixel look
        ctx.drawImage(uploadImg, x0, y0, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = 1; ctx.restore();
        drawnRef.current.img = { area: fr.imageArea, natW, natH, x0, y0, w, h };
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      if (fr.textArea && text) {
        const natW = 300, natH = 300 / (fr.textArea.aspect || 3.75);
        const fs = Math.round(natH * 0.62 * pl.text.s);
        const tx = natW / 2 + pl.text.x * natW / 2, ty = natH / 2 + pl.text.y * natH / 2;
        quadTransform(ctx, fr.textArea, W, H, natW, natH);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, natW, natH); ctx.clip();
        ctx.fillStyle = textColorHex || "#37282d";
        ctx.font = `600 ${fs}px Futura, 'Avenir Next', 'Trebuchet MS', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const tw = Math.min(ctx.measureText(text).width, natW * 0.94);
        ctx.fillText(text, tx, ty, natW * 0.94);
        ctx.restore();
        drawnRef.current.text = { area: fr.textArea, natW, natH, x0: tx - tw / 2, y0: ty - fs / 2, w: tw, h: fs };
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    })();
    return () => { stale = true; };
  }, [ready, cur, preview, zoneColors, hexOf, uploadImg, text, textColorHex, pl]); // eslint-disable-line react-hooks/exhaustive-deps

  // canvas pixel → natural units of a printable area (inverse of quadTransform)
  const toNat = (e, item) => {
    const r = canvasRef.current.getBoundingClientRect(); const [W, H] = preview.res;
    const cx = (e.clientX - r.left) * W / r.width, cy = (e.clientY - r.top) * H / r.height;
    const { tl, tr, bl } = item.area; const a = (tr[0] - tl[0]) / item.natW, b = (tr[1] - tl[1]) / item.natW, c = (bl[0] - tl[0]) / item.natH, d = (bl[1] - tl[1]) / item.natH;
    const det = a * d - b * c; if (!det) return null;
    return { u: (d * (cx - tl[0]) - c * (cy - tl[1])) / det, v: (-b * (cx - tl[0]) + a * (cy - tl[1])) / det };
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    // on the picture or the name → move it; anywhere else → spin the model
    for (const kind of ["text", "img"]) {
      const it = drawnRef.current[kind]; if (!it || !onPlace) continue;
      const n = toNat(e, it); if (!n) continue;
      const pad = it.natW * 0.04;
      if (n.u >= it.x0 - pad && n.u <= it.x0 + it.w + pad && n.v >= it.y0 - pad && n.v <= it.y0 + it.h + pad) { dragRef.current = { kind, start: n, from: { ...pl[kind] }, item: it }; return; }
    }
    dragRef.current = { x: e.clientX, spin };
  };
  const onPointerMove = (e) => {
    const dr = dragRef.current; if (!dr) return;
    if (dr.kind) { const n = toNat(e, dr.item); if (!n) return; const clampv = (v) => Math.max(-1, Math.min(1, v));
      onPlace(dr.kind, { ...dr.from, x: clampv(dr.from.x + (n.u - dr.start.u) / (dr.item.natW / 2)), y: clampv(dr.from.y + (n.v - dr.start.v) / (dr.item.natH / 2)) }); return; }
    const dx = e.clientX - dr.x;
    setSpin(dr.spin - Math.round(dx / 36));
  };
  const onPointerUp = () => { dragRef.current = null; };

  return (
    <div>
      <div className="pdp-main"
        style={{ cursor: "grab", touchAction: "pan-y", userSelect: "none" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {ready
          ? <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
          : <div style={{ height: "100%" }} />}
      </div>
      {onPlace && (uploadUrl || text) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center", marginTop: 8, fontSize: 12 }}>
          {uploadUrl && <label>Picture size <input type="range" min="0.4" max="1.6" step="0.05" value={pl.img.s} onChange={(e) => onPlace("img", { ...pl.img, s: Number(e.target.value) })} /></label>}
          {text && <label>Name size <input type="range" min="0.5" max="1.5" step="0.05" value={pl.text.s} onChange={(e) => onPlace("text", { ...pl.text, s: Number(e.target.value) })} /></label>}
          <button className="opt" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => { onPlace("img", { x: 0, y: 0, s: 1 }); onPlace("text", { x: 0, y: 0, s: 1 }); }}>Reset placement</button>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 10 }}>
        <span className="hint">⟲ drag the model to spin · drag your picture or name to move it</span>
        {hasBack && (
          <button className="opt" style={{ padding: "6px 12px", fontSize: 13 }}
            onClick={() => { setSide(side === "front" ? "back" : "front"); setSpin(0); }}>
            {side === "front" ? "Show back ↷" : "Show front ↶"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- the product page: gallery · options · buy box · reviews ---------- */

function deliveryText(shipDays) {
  const d = new Date(); d.setDate(d.getDate() + shipDays[1] + 3);   // print days + a few days in the mail
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function Customizer({ product, colors, shippingCents, shipDays, initialReviews, addons }) {
  const AD = addons || ADDON_DEFAULT;
  const [placement, setPlacement] = useState(PL0);
  const router = useRouter();
  const zones = product.zones || ["Color"];
  const [photo, setPhoto] = useState(0);
  const [zoneColors, setZoneColors] = useState({});
  const [colorRequest, setColorRequest] = useState("");
  const [text, setText] = useState("");
  const [upload, setUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [reviews, setReviews] = useState(initialReviews || { count: 0, average: null, reviews: [] });
  const [me, setMe] = useState(null);

  const hasPreview = !!product.preview;
  const [showLive, setShowLive] = useState(hasPreview);
  const storageKey = `customize:${product.slug}`;
  const hexOf = useMemo(() => { const map = Object.fromEntries(colors.map((c) => [c.name, c.hex])); return (name) => map[name]; }, [colors]);
  const stockOf = useMemo(() => Object.fromEntries(colors.map((c) => [c.name, c.stock || "plenty"])), [colors]);

  useEffect(() => {
    try { const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (saved) { setZoneColors(saved.zoneColors ?? {}); setColorRequest(saved.colorRequest ?? ""); setText(saved.text ?? ""); setUpload(saved.upload ?? null); setQty(saved.qty ?? 1); if (saved.placement) setPlacement({ ...PL0, ...saved.placement }); } } catch {}
    fetch("/api/me", { cache: "no-store" }).then((r) => r.json()).then(setMe).catch(() => setMe({}));
  }, [storageKey]);
  const save = (patch) => { const state = { zoneColors, colorRequest, text, upload, qty, placement, ...patch }; try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch {} };
  const pickColor = (zone, name) => { const zc = { ...zoneColors, [zone]: name }; setZoneColors(zc); setError(""); save({ zoneColors: zc }); };

  const onFile = async (file) => {
    setError(""); if (!file) return;
    if (!OK_TYPES.includes(file.type) && !/\.heic$/i.test(file.name)) { setError("That file type won't work — please upload a JPG, PNG, or iPhone photo."); return; }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) { setError(`That image is too large — the limit is ${MAX_UPLOAD_MB} MB.`); return; }
    const localUrl = URL.createObjectURL(file);
    setUpload({ url: null, localUrl, name: file.name, size: file.size }); setUploading(true);
    try { const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, { method: "POST", body: file }); const data = await res.json();
      if (!res.ok) throw new Error(data.error || "upload failed");
      const u = { url: data.url, localUrl, name: file.name, size: file.size }; setUpload(u); save({ upload: { url: data.url, name: file.name, size: file.size } });
    } catch { setUpload(null); setError("The upload didn't go through — please try again."); } finally { setUploading(false); }
  };

  const mainZone = zones[0];
  const textZone = product.preview?.canvasTextZone;
  const activeZones = zones.filter((z) => z !== textZone || (product.text && text.trim()));
  const effectiveColors = Object.fromEntries(activeZones.map((z) => [z, zoneColors[z] || zoneColors[mainZone] || null]));
  const distinctColors = new Set(Object.values(effectiveColors).filter(Boolean)).size;
  const extraColors = Math.max(0, distinctColors - 1);
  const addonTotal = (product.text && text.trim() ? AD.text : 0) + (product.image && upload ? AD.image : 0) + extraColors * AD.extraColor;
  const unitCents = Math.round((product.price + addonTotal) * 100);
  const moved = (k) => placement[k].x !== 0 || placement[k].y !== 0 || placement[k].s !== 1;
  const placeText = (k) => `${Math.round(50 + placement[k].x * 50)}% across, ${Math.round(50 + placement[k].y * 50)}% down, size ${Math.round(placement[k].s * 100)}%`;
  const setPlace = (k, v) => { const p = { ...placement, [k]: v }; setPlacement(p); save({ placement: p }); };
  const textColorHex = hexOf(effectiveColors[product.preview?.canvasTextZone]) || "#37282d";
  const lowPicked = Object.values(effectiveColors).filter((c) => c && stockOf[c] === "low");

  const makeLine = () => {
    if (product.in_stock === false) { setError("This product is sold out right now."); return null; }
    if (!zoneColors[mainZone]) { setError("Please pick a color first."); return null; }
    if (product.image?.required && !upload) { setError("Please upload your image first — this product is printed from it."); return null; }
    if (uploading) { setError("One moment — your picture is still uploading."); return null; }
    const colorStr = activeZones.length > 1 ? activeZones.map((z) => `${z}: ${effectiveColors[z]}`).join(" · ") : effectiveColors[mainZone];
    const summary = [`Color: ${colorStr}`, colorRequest.trim() && `Color request: "${colorRequest.trim()}"`, product.text && text.trim() && `Text: "${text.trim()}"${moved("text") ? ` (${placeText("text")})` : ""}`, product.image && upload && `Picture: ${upload.name}${moved("img") ? ` (${placeText("img")})` : ""}`].filter(Boolean).join(" · ");
    return { slug: product.slug, name: product.name, photo: product.photos[0], qty, colors: effectiveColors, colorRequest: colorRequest.trim() || null,
      text: product.text && text.trim() ? text.trim() : null, uploadUrl: upload?.url || null, uploadName: upload?.name || null, unitCents, summary,
      placement: (moved("img") || moved("text")) ? { img: upload ? placement.img : undefined, text: text.trim() ? placement.text : undefined } : undefined };
  };
  const addToCart = () => { const line = makeLine(); if (!line) return; cart.add(line); setAdded(true); setError(""); setTimeout(() => setAdded(false), 2500); };
  const buyNow = () => { const line = makeLine(); if (!line) return; cart.add(line); router.push("/checkout"); };

  // reviews
  const [rvStars, setRvStars] = useState(0); const [rvTitle, setRvTitle] = useState(""); const [rvBody, setRvBody] = useState(""); const [rvMsg, setRvMsg] = useState("");
  const sendReview = async () => {
    if (!rvStars) { setRvMsg("Pick a star rating first."); return; }
    const res = await fetch(`/api/reviews/${product.slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stars: rvStars, title: rvTitle, body: rvBody }) });
    const d = await res.json();
    if (!res.ok) { setRvMsg(d.error || "Could not save the review."); return; }
    setRvMsg("Thanks — your review is up."); setRvTitle(""); setRvBody("");
    const r2 = await fetch(`/api/reviews/${product.slug}`, { cache: "no-store" }).then((r) => r.json()); setReviews(r2);
  };
  const signIn = `https://log3d.hardywu.com/?p=${product.slug}`;

  return (<>
    <main className="pdp">
      <div className="pdp-photos">
        <div className="pdp-thumbs">
          {hasPreview && <button className={showLive ? "sel" : ""} onClick={() => setShowLive(true)} style={{ color: "var(--accent)", fontWeight: 700 }}>✨ Live</button>}
          {product.photos.map((src, i) => (
            <button key={src} className={!showLive && i === photo ? "sel" : ""} onClick={() => { setShowLive(false); setPhoto(i); }} aria-label={`Photo ${i + 1}`}><img src={src} alt="" /></button>
          ))}
        </div>
        <div>
          {hasPreview && showLive ? (
            <PreviewCanvas preview={product.preview} zoneColors={effectiveColors} hexOf={hexOf}
              uploadUrl={product.image ? (upload?.localUrl || upload?.url) : null}
              text={product.preview?.frames?.some((f) => f.textArea) ? text.trim() : null} textColorHex={textColorHex} palette={colors}
              placement={placement} onPlace={setPlace} />
          ) : (
            <div className="pdp-main"><img src={product.photos[photo] || product.photos[0]} alt={product.name} /></div>
          )}
          {hasPreview && showLive && <p className="hint" style={{ marginTop: 8 }}>This is how it will be printed, in this orientation. Drag the model to spin it; <b>drag your picture or your name to move them</b>, and use the sliders for size. The real print may vary slightly.</p>}
        </div>
      </div>

      <div className="pdp-form">
        <h1>{product.name}</h1>
        <div className="pdp-brand">Made to order by <a href="https://hardywu.com/">Hardy Wu</a> · {product.category}</div>
        <Stars average={reviews.average} count={reviews.count} link="#reviews" />
        <div className="price-big"><sup>$</sup>{product.price.toFixed(2)}<span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 400 }}> base price</span></div>
        <div className="price-note">+${AD.text} for a name, +${AD.image} for a picture, +${AD.extraColor} per extra color · <b style={{ color: "var(--ok)" }}>FREE shipping</b> (US)</div>
        <p className="pdp-desc">{product.description}</p>
        {product.bullets?.length > 0 && <><div className="sec-title">About this item</div><ul className="bullets">{product.bullets.map((b) => <li key={b}>{b}</li>)}</ul></>}

        <div className="sec-title">Make it yours</div>
        {activeZones.map((zone, zi) => (
          <div className="field" key={zone}>
            <div className="field-label">
              <span>{zones.length > 1 ? `${zone} color` : product.multicolored ? "Main color (the rest as shown)" : "Color"} {zi === 0 ? <span className="req">· required</span> : <span style={{ fontWeight: 400 }}>· optional (+${AD.extraColor} if different)</span>}</span>
              <span className="swatch-name">{zoneColors[zone] ?? (zi === 0 ? "pick one" : `same as ${mainZone}`)}</span>
            </div>
            <div className="swatches">
              {zi > 0 && <button className={`opt${!zoneColors[zone] ? " sel" : ""}`} onClick={() => { const zc = { ...zoneColors }; delete zc[zone]; setZoneColors(zc); save({ zoneColors: zc }); }}>Same</button>}
              {colors.map((c) => (
                <button key={c.name} className={`swatch${zoneColors[zone] === c.name ? " sel" : ""}${c.stock === "low" ? " low" : ""}`}
                  style={c.transparent ? { background: "repeating-conic-gradient(#cfd8db 0% 25%, #ffffff 0% 50%) 50% / 12px 12px" } : { background: c.hex }}
                  onClick={() => pickColor(zone, c.name)} aria-label={`${zone}: ${c.name}${c.stock === "low" ? " (only a little left)" : ""}`} title={`${c.name}${c.stock === "low" ? " — only a little left" : ""}`} />
              ))}
            </div>
          </div>
        ))}
        <div className="stock-note">Plenty of orange, red and black filament. <b>Only a little left</b> of blue, purple, white and clear — Hardy will tell you if yours runs out before printing.</div>
        {lowPicked.length > 0 && <div className="stock-note" style={{ color: "#fbbf24" }}>⚠️ {lowPicked.join(", ")}: only a little left in stock.</div>}
        <div className="field">
          <textarea className="textbox" rows={1} placeholder="Want a color you don't see? Ask here — Hardy checks before printing." value={colorRequest} maxLength={200}
            onChange={(e) => { setColorRequest(e.target.value); save({ colorRequest: e.target.value }); }} />
        </div>
        {product.text && (
          <div className="field">
            <div className="field-label"><span>Custom text{product.text.detail ? ` — ${product.text.detail}` : ""} (+${AD.text})</span><span>{text.length} / {MAX_TEXT}</span></div>
            <input className="textbox" value={text} maxLength={MAX_TEXT} placeholder="Leave empty for no text (free)" onChange={(e) => { setText(e.target.value); save({ text: e.target.value }); }} />
          </div>
        )}
        {product.image && (
          <div className="field">
            <div className="field-label"><span>Your picture (+${AD.image}){product.image.required ? <> <span className="req">· required</span></> : " — optional"}</span></div>
            <label className="drop" style={{ cursor: "pointer" }}>
              {upload ? <img className="drop-thumb" src={upload.localUrl || upload.url} alt="Your upload" /> : <div className="drop-thumb" />}
              <p>{uploading ? "Uploading…" : upload ? <><span className="ok-line">✓ {upload.name} uploaded</span><br />Click to replace it.</> : <>Click to upload a JPG, PNG, or iPhone photo (up to {MAX_UPLOAD_MB} MB).<br /><span className="hint">{product.image.detail}</span></>}</p>
              <input type="file" accept="image/jpeg,image/png,image/heic,image/heif" style={{ display: "none" }} onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </div>
        )}
        {error && <div className="error" role="alert">{error}</div>}
      </div>

      <aside className="buybox">
        <div className="price-big"><sup>$</sup>{(unitCents / 100).toFixed(2)}</div>
        <div className="deliv"><b style={{ color: "var(--ok)" }}>FREE shipping</b> (US). Printed to order in {shipDays[0]}–{shipDays[1]} days, so expect it around <b>{deliveryText(shipDays)}</b>.</div>
        {product.in_stock === false ? <div className="soldout" style={{ fontSize: 17 }}>Sold out for now</div> : <div className="ok">In stock</div>}
        <div className="field" style={{ marginTop: 2 }}>
          <div className="field-label"><span>Quantity</span></div>
          <div className="qty"><button onClick={() => { const q = Math.max(1, qty - 1); setQty(q); save({ qty: q }); }} aria-label="Fewer">−</button><span>{qty}</span><button onClick={() => { const q = Math.min(9, qty + 1); setQty(q); save({ qty: q }); }} aria-label="More">+</button></div>
        </div>
        <button className="btn-yellow" onClick={addToCart} disabled={uploading || product.in_stock === false}>{added ? "✓ Added to cart" : "Add to Cart"}</button>
        <button className="btn-orange" onClick={buyNow} disabled={uploading || product.in_stock === false}>Buy Now</button>
        {added && <div style={{ fontSize: 13 }}><a href="/cart">Go to cart →</a></div>}
        <div className="secure">🔒 No card needed now — Hardy emails you to arrange payment and shipping.</div>
        <div className="sold-by"><span>Ships from</span><b>Hardy's 3D</b><span>Sold by</span><b>Hardy Wu</b><span>Returns</span><b>Reprinted free if it arrives broken</b></div>
        <div className="sline"><span>{product.name} × {qty}</span><span>{money(unitCents * qty)}</span></div>
        <div className="sline"><span>Shipping</span><span>{shippingCents ? money(shippingCents) : "FREE"}</span></div>
        <div className="sline total"><span>Order total</span><span>{money(unitCents * qty + shippingCents)}</span></div>
      </aside>
    </main>

    <section className="reviews" id="reviews">
      <div>
        <h2>Customer reviews</h2>
        <div className="rv-avg"><Stars average={reviews.average} count={reviews.count} size={18} /></div>
        {me?.name ? (
          <div className="rv-form">
            <b>Review this product</b>
            <div className="rv-stars" role="radiogroup" aria-label="Stars">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={n <= rvStars ? "on" : ""} onClick={() => setRvStars(n)} aria-label={`${n} stars`}>★</button>)}</div>
            <input className="textbox" placeholder="Headline" value={rvTitle} maxLength={80} onChange={(e) => setRvTitle(e.target.value)} />
            <textarea className="textbox" rows={3} placeholder="What did you think?" value={rvBody} maxLength={1000} onChange={(e) => setRvBody(e.target.value)} />
            <button className="btn-yellow" onClick={sendReview}>Submit review</button>
            {rvMsg && <div className="hint">{rvMsg}</div>}
          </div>
        ) : (
          <div className="rv-form"><b>Review this product</b><span className="hint">Share your thoughts with other customers.</span><a href={signIn} className="btn-yellow">Sign in to write a review</a></div>
        )}
      </div>
      <div>
        {reviews.count === 0 && <p style={{ color: "var(--ink-soft)" }}>No reviews yet.</p>}
        {(reviews.reviews || []).map((r) => (
          <div className="rv" key={r.id}>
            <div className="who">{r.name || "A customer"} · {new Date(r.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
            <div><span className="star-row" style={{ color: "var(--star)" }}>{"★★★★★".slice(0, r.stars)}</span><span className="star-row" style={{ color: "#c9c9c9" }}>{"★★★★★".slice(r.stars)}</span></div>
            {r.title && <div className="ttl">{r.title}</div>}
            {r.body && <p>{r.body}</p>}
          </div>
        ))}
      </div>
    </section>
  </>);
}
