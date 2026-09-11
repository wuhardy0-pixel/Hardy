"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MAX_TEXT = 30;
const MAX_UPLOAD_MB = 10;
const OK_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"];
const ADDON = 2; // dollars: per picture, per text, per extra color

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

function PreviewCanvas({ preview, zoneColors, hexOf, uploadUrl, text, textColorHex, palette }) {
  const canvasRef = useRef(null);
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

      if (fr.imageArea && uploadImg) {
        // natural units match the area's real-world proportions: no distortion
        const natW = 100, natH = 100 / (fr.imageArea.aspect || 4 / 3);
        const s = Math.min(natW / uploadImg.width, natH / uploadImg.height);
        const w = uploadImg.width * s, h = uploadImg.height * s;
        quadTransform(ctx, fr.imageArea, W, H, natW, natH);
        ctx.globalAlpha = 0.96;
        ctx.imageSmoothingEnabled = false; // crisp printed-pixel look
        ctx.drawImage(uploadImg, (natW - w) / 2, (natH - h) / 2, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      if (fr.textArea && text) {
        const natW = 300, natH = 300 / (fr.textArea.aspect || 3.75);
        quadTransform(ctx, fr.textArea, W, H, natW, natH);
        ctx.fillStyle = textColorHex || "#37282d";
        ctx.font = `600 ${Math.round(natH * 0.62)}px Futura, 'Avenir Next', 'Trebuchet MS', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, natW / 2, natH / 2, natW * 0.94);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    })();
    return () => { stale = true; };
  }, [ready, cur, preview, zoneColors, hexOf, uploadImg, text, textColorHex]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = (e) => {
    dragRef.current = { x: e.clientX, spin };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    setSpin(dragRef.current.spin - Math.round(dx / 36));
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 10 }}>
        <span className="hint">⟲ drag the picture to spin it</span>
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

/* ---------- customizer ---------- */

export default function Customizer({ product, colors, shippingCents }) {
  const zones = product.zones || ["Color"];
  const [photo, setPhoto] = useState(0);           // gallery index; -1 = live preview
  const [zoneColors, setZoneColors] = useState({});
  const [colorRequest, setColorRequest] = useState("");
  const [text, setText] = useState("");
  const [upload, setUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const hasPreview = !!product.preview;
  const [showLive, setShowLive] = useState(hasPreview);
  const storageKey = `customize:${product.slug}`;
  const hexOf = useMemo(() => {
    const map = Object.fromEntries(colors.map((c) => [c.name, c.hex]));
    return (name) => map[name];
  }, [colors]);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (saved) {
        setZoneColors(saved.zoneColors ?? {});
        setColorRequest(saved.colorRequest ?? "");
        setText(saved.text ?? "");
        setUpload(saved.upload ?? null);
        setQty(saved.qty ?? 1);
      }
    } catch {}
  }, [storageKey]);

  const save = (patch) => {
    const state = { zoneColors, colorRequest, text, upload, qty, ...patch };
    try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
  };

  const pickColor = (zone, name) => {
    const zc = { ...zoneColors, [zone]: name };
    setZoneColors(zc); setError(""); save({ zoneColors: zc });
  };

  const onFile = async (file) => {
    setError("");
    if (!file) return;
    if (!OK_TYPES.includes(file.type) && !/\.heic$/i.test(file.name)) {
      setError("That file type won't work — please upload a JPG, PNG, or iPhone photo.");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`That image is too large — the limit is ${MAX_UPLOAD_MB} MB.`);
      return;
    }
    // show the picture instantly from the device while the upload runs
    const localUrl = URL.createObjectURL(file);
    setUpload({ url: null, localUrl, name: file.name, size: file.size });
    setUploading(true);
    try {
      const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: "POST", body: file,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "upload failed");
      const u = { url: data.url, localUrl, name: file.name, size: file.size };
      setUpload(u); save({ upload: { url: data.url, name: file.name, size: file.size } });
    } catch {
      setUpload(null);
      setError("The upload didn't go through — please try again.");
    } finally {
      setUploading(false);
    }
  };

  // ---- effective colors: only the first zone is required; the rest default to it.
  // The text-color zone only exists once the customer has typed text.
  const mainZone = zones[0];
  const textZone = product.preview?.canvasTextZone;
  const activeZones = zones.filter((z) => z !== textZone || (product.text && text.trim()));
  const effectiveColors = Object.fromEntries(
    activeZones.map((z) => [z, zoneColors[z] || zoneColors[mainZone] || null])
  );

  // ---- pricing: base + $5 picture + $5 text + $5 per extra distinct color ----
  const distinctColors = new Set(Object.values(effectiveColors).filter(Boolean)).size;
  const extraColors = Math.max(0, distinctColors - 1);
  const addons =
    (product.text && text.trim() ? ADDON : 0) +
    (product.image && upload ? ADDON : 0) +
    extraColors * ADDON;
  const unitCents = (product.price + addons) * 100;
  const totalCents = unitCents * qty + shippingCents;
  const money = (c) => `$${(c / 100).toFixed(2)}`;

  const checkout = async () => {
    if (!zoneColors[mainZone]) { setError("Please pick a color first."); return; }
    if (product.image?.required && !upload) { setError("Please upload your image first — this product is printed from it."); return; }
    setBusy(true); setError(""); save({});
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: product.slug,
          colors: effectiveColors,
          colorRequest: colorRequest.trim() || null,
          text: text.trim() || null,
          uploadUrl: upload?.url || null,
          uploadName: upload?.name || null,
          qty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "checkout failed");
      window.location.href = data.url;
    } catch {
      setError("Something went wrong starting the payment — please try again.");
      setBusy(false);
    }
  };

  const textColorHex = hexOf(effectiveColors[product.preview?.canvasTextZone]) || "#37282d";

  return (
    <main className="pdp">
      <div className="pdp-photos">
        {hasPreview && showLive ? (
          <PreviewCanvas
            preview={product.preview}
            zoneColors={effectiveColors}
            hexOf={hexOf}
            uploadUrl={product.image ? (upload?.localUrl || upload?.url) : null}
            text={product.preview?.frames?.some((f) => f.textArea) ? text.trim() : null}
            textColorHex={textColorHex}
            palette={colors}
          />
        ) : (
          <div className="pdp-main"><img src={product.photos[photo] || product.photos[0]} alt={product.name} /></div>
        )}
        <div className="pdp-thumbs">
          {hasPreview && (
            <button className={showLive ? "sel" : ""} onClick={() => setShowLive(true)}
              style={{ width: "auto", padding: "0 10px", fontSize: 12, fontWeight: 600, color: showLive ? "var(--accent)" : "var(--ink-soft)" }}>
              ✨ Live
            </button>
          )}
          {product.photos.map((src, i) => (
            <button key={src} className={!showLive && i === photo ? "sel" : ""}
              onClick={() => { setShowLive(false); setPhoto(i); }} aria-label={`Photo ${i + 1}`}>
              <img src={src} alt="" />
            </button>
          ))}
        </div>
        {hasPreview && showLive && (
          <p className="hint" style={{ marginTop: 8 }}>
            Live preview — it updates as you pick colors, type your text, and upload your picture.
            {product.preview?.frames?.some((f) => f.side === "back")
              ? " Your name and picture go on the BACK — press “Show back” to see them."
              : ""} The real print may vary slightly.
          </p>
        )}
      </div>

      <div className="pdp-form">
        <h1 className="display">{product.name}</h1>
        <p className="pdp-desc">{product.description}</p>

        {activeZones.map((zone, zi) => (
          <div className="field" key={zone}>
            <div className="field-label">
              <span>
                {zones.length > 1 ? `${zone} color` : "Color"}{" "}
                {zi === 0
                  ? <span className="req">· required</span>
                  : <span>· optional (+${ADDON} if different)</span>}
              </span>
              <span className="swatch-name">
                {zoneColors[zone] ?? (zi === 0 ? "pick one" : `same as ${mainZone}`)}
              </span>
            </div>
            <div className="swatches">
              {zi > 0 && (
                <button
                  className={`opt${!zoneColors[zone] ? " sel" : ""}`}
                  onClick={() => {
                    const zc = { ...zoneColors };
                    delete zc[zone];
                    setZoneColors(zc); save({ zoneColors: zc });
                  }}>
                  Same
                </button>
              )}
              {colors.map((c) => (
                <button key={c.name}
                  className={`swatch${zoneColors[zone] === c.name ? " sel" : ""}`}
                  style={c.transparent
                    ? { background: "repeating-conic-gradient(#cfd8db 0% 25%, #ffffff 0% 50%) 50% / 12px 12px" }
                    : { background: c.hex }}
                  onClick={() => pickColor(zone, c.name)}
                  aria-label={`${zone}: ${c.name}`} title={c.name} />
              ))}
            </div>
          </div>
        ))}
        <div className="field">
          <textarea className="textbox" style={{ fontSize: 13.5 }} rows={1}
            placeholder="Want a color you don't see? Ask here — Barbara will check before printing."
            value={colorRequest} maxLength={200}
            onChange={(e) => { setColorRequest(e.target.value); save({ colorRequest: e.target.value }); }} />
          <div className="hint">One color is included — each additional color adds ${ADDON}.</div>
        </div>

        {product.text && (
          <div className="field">
            <div className="field-label">
              <span>Custom text{product.text.detail ? ` — ${product.text.detail}` : ""} (+${ADDON})</span>
              <span>{text.length} / {MAX_TEXT}</span>
            </div>
            <input className="textbox" value={text} maxLength={MAX_TEXT}
              placeholder="Leave empty for no text (free)"
              onChange={(e) => { setText(e.target.value); save({ text: e.target.value }); }} />
            <div className="hint">Printed exactly as typed, up to {MAX_TEXT} characters.</div>
          </div>
        )}

        {product.image && (
          <div className="field">
            <div className="field-label">
              <span>Your picture (+${ADDON}){product.image.required ? <> <span className="req">· required</span></> : " — optional"}</span>
            </div>
            <label className="drop" style={{ cursor: "pointer" }}>
              {upload ? <img className="drop-thumb" src={upload.localUrl || upload.url} alt="Your upload" /> : <div className="drop-thumb" />}
              <p>
                {uploading ? "Uploading…" : upload ? (
                  <><span className="ok-line">✓ {upload.name} uploaded</span><br />Click to replace it.</>
                ) : (
                  <>Click to upload a JPG, PNG, or iPhone photo (up to {MAX_UPLOAD_MB} MB).<br />
                  <span className="hint">{product.image.detail}</span></>
                )}
              </p>
              <input type="file" accept="image/jpeg,image/png,image/heic,image/heif"
                style={{ display: "none" }} onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {/small/i.test(product.image.detail || "") && upload && (
              <div className="hint" style={{ marginTop: 6, color: "var(--err)" }}>
                ⚠️ Your picture prints SMALL on this product (a few centimeters). It is shrunk
                to fit — that's why big pictures look tiny or trimmed in the preview. Simple
                images (a logo, initials, a simple shape) work best; detailed photos won't be clear.
              </div>
            )}
          </div>
        )}

        <div className="field">
          <div className="field-label"><span>Quantity</span></div>
          <div className="qty">
            <button onClick={() => { const q = Math.max(1, qty - 1); setQty(q); save({ qty: q }); }} aria-label="Fewer">−</button>
            <span>{qty}</span>
            <button onClick={() => { const q = Math.min(9, qty + 1); setQty(q); save({ qty: q }); }} aria-label="More">+</button>
          </div>
        </div>

        <div className="summary">
          <div className="summary-title">Your order</div>
          <div className="sline"><span>{product.name} × {qty}</span><span className="v">{money(product.price * 100 * qty)}</span></div>
          {activeZones.map((z) => (
            <div className="sline" key={z}><span>{activeZones.length > 1 ? `${z} color` : "Color"}</span><span className="v">{effectiveColors[z] ?? "—"}</span></div>
          ))}
          {extraColors > 0 && <div className="sline"><span>Extra colors × {extraColors}</span><span className="v">+{money(extraColors * ADDON * 100 * qty)}</span></div>}
          {colorRequest.trim() && <div className="sline"><span>Color request</span><span className="v">“{colorRequest.trim()}”</span></div>}
          {product.text && text.trim() && <div className="sline"><span>Text “{text.trim()}”</span><span className="v">+{money(ADDON * 100 * qty)}</span></div>}
          {product.image && upload && <div className="sline"><span>Your picture</span><span className="v">+{money(ADDON * 100 * qty)}</span></div>}
          <div className="sline"><span>Shipping (US)</span><span className="v">{money(shippingCents)}</span></div>
          <div className="sline total"><span>Total</span><span className="v">{money(totalCents)}</span></div>
        </div>

        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn big" style={{ marginTop: 10 }} onClick={checkout} disabled={busy || uploading}>
          {busy ? "One moment…" : "Continue to secure payment →"}
        </button>
        <p className="hint" style={{ textAlign: "center", marginTop: 8 }}>
          Payment is handled by Stripe. You&rsquo;ll enter your shipping address there.
        </p>
      </div>
    </main>
  );
}
