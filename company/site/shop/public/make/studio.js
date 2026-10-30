// The playground (shop.hardywu.com/make), as agreed in company/site/mocks/v2/make.html:
// sign in → My projects (start new / continue) → six steps, each with its own animation in the preview.
// Real here: sign-in (hardywu.com), saved projects (Hardy's server), picture upload, prices, the cart.
// The helper's replies are simple rules for now; each change is also saved as a request Hardy makes by hand.
(function () {
  const D = window.__PLAY;                       // models, colours, add-on prices (from the catalog)
  const KIND = { "customizable-lunchbox": "lunchbox", "dual-ruler": "ruler", "crab-gauge": "gauge" };
  const FONTS = { bubbly: "Nunito", bold: "'Arial Black',sans-serif", fancy: "Georgia,serif" }, FONT_NAMES = { bubbly: "Bubbly", bold: "Bold", fancy: "Fancy" };
  const STEPS = ["Pick", "Colours", "Name", "Picture", "Helper", "Print"];
  const $ = (id) => document.getElementById(id), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const hex = (n) => (D.colors.find((c) => c[0] === n) || D.colors[0])[1];
  const M = (p) => D.models[p.model];
  const kind = (p) => KIND[p.model] || "lunchbox";
  let user = null, projects = [], P = null, helper = { left: 10, free: 10, resets: null }, saveT;

  // ------------------------------------------------------------------ server
  async function api(path, body) {
    const r = await fetch("/api/playground/" + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
    const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, ...j };
  }
  function persist() { if (!P) return; clearTimeout(saveT); saveT = setTimeout(async () => { const r = await api("projects", P); if (r.ok && r.id) P.id = r.id; }, 600); }

  // ------------------------------------------------------------------ views
  function show(v) { document.querySelectorAll("#studio .view, #v-loading").forEach((x) => x.classList.toggle("on", x.id === "v-" + v)); $("v-loading").style.display = v === "loading" ? "block" : "none"; scrollTo({ top: 0, behavior: still ? "auto" : "smooth" }); }
  function toast(t) { let el = document.querySelector(".toast"); if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = t; el.classList.add("show"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2200); }
  function ago(t) { const d = Math.floor((Date.now() - new Date(t).getTime()) / 864e5); return d <= 0 ? "edited today" : d === 1 ? "edited yesterday" : `edited ${d} days ago`; }
  function newProject(over = {}) { const first = D.models["customizable-lunchbox"] ? "customizable-lunchbox" : Object.keys(D.models)[0];
    return Object.assign({ id: null, title: "My new project", model: first, colors: defaults(first), text: "", font: "bubbly", pic: null, picName: null,
      params: { corner: 28, handle: 1, size: 1, pattern: "none", textSize: 1 }, step: 1, status: "draft", asks: [] }, over); }
  function defaults(slug) { const z = D.models[slug].zones, c = KIND[slug] === "lunchbox" ? "Purple" : "Blue"; const o = {}; z.forEach((k) => (o[k] = k === D.models[slug].textZone ? "White" : c)); return o; }

  async function start() {
    show("loading");
    try { user = await (await fetch("/api/me", { cache: "no-store" })).json(); } catch { user = {}; }
    if (!user || !user.name) { if (D.signin) $("signin").href = D.signin; show("signin"); gatePrint(); return; }
    const r = await api("projects");
    if (!r.ok) { show("signin"); return; }
    projects = r.projects || []; helper = r.helper || helper; openProjects();
  }

  function openProjects() {
    $("hello").textContent = `Hi ${user.name.split(" ")[0]}!`; renderAllow();
    $("projects").innerHTML = `<div class="new press" id="newp" role="button" tabindex="0"><div class="plus"><svg class="i"><use href="#i-plus"/></svg></div><h2>Start something new</h2><p class="small">Pick a model, add your name and picture, and ask the helper for changes.</p></div>` +
      projects.map((p) => `<div class="proj clay"><div class="thumb">${D.models[p.model] ? drawSVG(p, true) : ""}</div>
        <div class="meta"><div><h3>${esc(p.title || "My project")}</h3><span class="small">${esc((D.models[p.model] || {}).short || "")} · ${ago(p.updated)}</span></div>
        <span class="badge ${p.status === "ordered" ? "done" : ""}">${p.status === "ordered" ? "In your cart ✓" : `Step ${p.step || 1} of 6`}</span></div>
        <div class="row"><button class="mini go press" data-open="${p.id}">${p.status === "ordered" ? "Make another" : "Continue"}</button><button class="mini press" data-del="${p.id}">Delete</button></div></div>`).join("");
    $("newp").onclick = () => { P = newProject(); openStudio(1); };
    $("newp").onkeydown = (e) => { if (e.key === "Enter") $("newp").click(); };
    $("projects").querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => {
      let p = projects.find((x) => x.id === b.dataset.open); if (!p || !D.models[p.model]) return;
      p = JSON.parse(JSON.stringify(p));
      if (p.status === "ordered") p = { ...p, id: null, title: (p.title || "My project") + " (copy)", status: "draft", step: 1, asks: [] };
      P = newProject(p); openStudio(P.step);
    }));
    $("projects").querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      if (!confirm("Delete this project?")) return; await api("projects/delete", { id: b.dataset.del });
      projects = projects.filter((x) => x.id !== b.dataset.del); openProjects();
    }));
    show("projects");
  }

  // ------------------------------------------------------------------ the studio
  function openStudio(step) {
    $("pname").value = P.title; buildBases(); buildZones(); $("txt").value = P.text || ""; setFonts(); setPicRow();
    $("chat").innerHTML = "";
    addMsg("bot", `Hi! I'm Hardy's helper. Tell me what to change on your ${M(P).short.toLowerCase()}: rounder corners${kind(P) === "lunchbox" ? ", a bigger handle" : ""}, stars or hearts on top, a bigger name…`, false);
    (P.asks || []).forEach((a) => { addMsg("me", a.q, false); addMsg("bot", a.a, false); });
    buildChips(); show("studio"); go(step || 1);
  }
  $("pname").oninput = () => { P.title = $("pname").value || "My project"; persist(); };
  function go(n) {
    P.step = Math.max(1, Math.min(6, n));
    $("tracker").querySelectorAll(".st").forEach((x) => x.remove());
    $("tracker").insertAdjacentHTML("beforeend", STEPS.map((s, i) => `<button class="st ${i + 1 < P.step ? "done" : ""} ${i + 1 === P.step ? "cur" : ""}" data-s="${i + 1}" ${i + 1 > P.step ? "disabled" : ""}><i>${i + 1 < P.step ? "✓" : i + 1}</i>${s}</button>`).join(""));
    $("tracker").querySelectorAll(".st").forEach((b) => (b.onclick = () => go(+b.dataset.s)));
    document.querySelectorAll("#studio .pane").forEach((p) => p.classList.toggle("on", +p.dataset.p === P.step));
    $("back").textContent = P.step === 1 ? "← My projects" : "← Back"; $("next").style.visibility = P.step === 6 ? "hidden" : "visible";
    $("next").textContent = ["", "Next: colours →", "Next: name →", "Next: picture →", "Next: the helper →", "Next: print →"][P.step] || "";
    $("ptag").textContent = ["", "Pick a model", "Colours", "Your name", "Your picture", "The helper", "Ready to print"][P.step];
    draw(P.step); persist();
    // each step plays its own animation when you arrive
    if (P.step === 2) splash(hex(P.colors[M(P).zones[0]])); if (P.step === 5) sparkles();
  }
  $("back").onclick = () => (P.step === 1 ? (persist(), start()) : go(P.step - 1));
  $("next").onclick = () => go(P.step + 1);

  // step 1
  function buildBases() {
    $("bases").innerHTML = Object.entries(D.models).map(([k, m]) => `<button class="base" data-k="${k}" aria-pressed="${k === P.model}"><img src="${m.photo}" alt=""><b>${esc(m.short)}</b><span>from $${m.price.toFixed(2)}</span></button>`).join("");
    $("bases").querySelectorAll(".base").forEach((b) => (b.onclick = () => {
      if (P.model !== b.dataset.k) { P.model = b.dataset.k; P.colors = defaults(P.model); buildZones(); buildChips(); }
      $("bases").querySelectorAll(".base").forEach((x) => x.setAttribute("aria-pressed", x === b)); draw(1);
    }));
  }
  // step 2
  function buildZones() {
    const m = M(P);
    $("zones").innerHTML = m.zones.map((z) => `<div class="zone"><label>${z}${z === m.textZone ? " (the letters)" : ""} <span id="zn-${z}">· ${P.colors[z]}</span></label><div class="sw" data-z="${z}">${D.colors.map(([n, h, low]) => `<button style="background:${h}" aria-label="${z}: ${n}${low ? " (running low)" : ""}" aria-pressed="${P.colors[z] === n}" data-c="${n}"></button>`).join("")}</div></div>`).join("");
    $("zones").querySelectorAll("button[data-c]").forEach((b) => (b.onclick = () => {
      const z = b.parentElement.dataset.z; P.colors[z] = b.dataset.c;
      b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b)); $("zn-" + z).textContent = "· " + b.dataset.c; draw(0); splash(hex(b.dataset.c));
    }));
  }
  // step 3
  $("txt").oninput = () => { P.text = $("txt").value; draw(3); };
  function setFonts() { $("fonts").querySelectorAll("button").forEach((b) => { b.setAttribute("aria-pressed", b.dataset.f === P.font); b.onclick = () => { P.font = b.dataset.f; setFonts(); draw(3); }; }); }
  // step 4: the picture goes to the store's real upload, so Hardy gets it with the order
  async function setPic(f) {
    if (!f) return;
    if (!/\.(jpe?g|png|heic|heif)$/i.test(f.name)) { toast("Please choose a JPG, PNG or iPhone photo."); return; }
    if (f.size > 10 * 1024 * 1024) { toast("That picture is bigger than 10 MB."); return; }
    toast("Uploading your picture…");
    try { const r = await fetch(`/api/upload?filename=${encodeURIComponent(f.name)}`, { method: "POST", body: f }); const j = await r.json();
      if (!r.ok) throw new Error(j.error); P.pic = j.url; P.picName = f.name; setPicRow(); draw(4); puffs(); persist(); toast("Picture added");
    } catch (e) { toast("The upload didn't go through. Please try again."); }
  }
  $("pic").onchange = (e) => setPic(e.target.files[0]);
  const drop = $("drop"); drop.ondragover = (e) => { e.preventDefault(); drop.style.borderColor = "#f8991d"; }; drop.ondragleave = () => (drop.style.borderColor = "");
  drop.ondrop = (e) => { e.preventDefault(); drop.style.borderColor = ""; setPic(e.dataTransfer.files[0]); };
  function setPicRow() { $("picrow").classList.toggle("on", !!P.pic); if (P.pic) $("picthumb").src = P.pic; }
  $("nopic").onclick = () => { P.pic = null; P.picName = null; $("pic").value = ""; setPicRow(); draw(0); persist(); };

  // ------------------------------------------------------------------ step 5: the helper
  const RULES = [
    [/round|soft|curv/i, (p) => { p.corner = Math.min(60, p.corner + 14); return "Done! The corners are rounder and softer now."; }],
    [/sharp|square|pointy/i, (p) => { p.corner = Math.max(6, p.corner - 14); return "Okay, sharper corners."; }],
    [/handle/i, (p, t) => { if (/small|less|thin|tiny/i.test(t)) { p.handle = Math.max(0.6, p.handle - 0.25); return "I made the handle a bit smaller."; } p.handle = Math.min(1.7, p.handle + 0.25); return "The handle is bigger now, easier to carry!"; }],
    [/star/i, (p) => { p.pattern = "stars"; return "I sprinkled stars across the top. ⭐"; }],
    [/heart/i, (p) => { p.pattern = "hearts"; return "Hearts it is!"; }],
    [/dot|spot|polka/i, (p) => { p.pattern = "dots"; return "Polka dots added."; }],
    [/plain|no pattern|remove (the )?(stars|hearts|dots|pattern)/i, (p) => { p.pattern = "none"; return "Back to a plain top."; }],
    [/(bigger|larger) (name|letters|text)|name bigger|text bigger/i, (p) => { p.textSize = Math.min(1.5, p.textSize + 0.15); return "Your name is bigger now."; }],
    [/(smaller) (name|letters|text)|name smaller|text smaller/i, (p) => { p.textSize = Math.max(0.6, p.textSize - 0.15); return "I made the name a little smaller."; }],
    [/tall|bigger|larger|deeper/i, (p) => { p.size = Math.min(1.25, p.size + 0.08); return "Made it a bit bigger."; }],
    [/short|smaller|tiny|little/i, (p) => { p.size = Math.max(0.8, p.size - 0.08); return "Made it a bit smaller."; }],
  ];
  function buildChips() { const c = kind(P) === "lunchbox" ? ["Rounder corners", "Bigger handle", "Add stars", "Add hearts", "Bigger name"] : ["Rounder corners", "Add stars", "Add dots", "Bigger name", "Make it smaller"];
    $("chips").innerHTML = c.map((t) => `<button>${t}</button>`).join(""); $("chips").querySelectorAll("button").forEach((b) => (b.onclick = () => ask(b.textContent))); }
  function addMsg(who, t) { const d = document.createElement("div"); d.className = "msg " + who; d.textContent = t; $("chat").appendChild(d); $("chat").scrollTop = 1e6; return d; }
  async function ask(text) {
    text = (text || "").trim().slice(0, 140); if (!text) return; $("ask").value = "";
    addMsg("me", text); const think = addMsg("bot", "Thinking…"); think.classList.add("think"); $("working").classList.add("on");
    const rule = RULES.find(([re]) => re.test(text));
    await new Promise((r) => setTimeout(r, still ? 50 : 1100));
    if (!rule) { think.remove(); $("working").classList.remove("on"); addMsg("bot", "I can change the corners, the handle, the size, stars, hearts or dots on top, and how big your name is. Try one of the buttons below!"); return; }
    const r = await api("helper", {});
    think.remove(); $("working").classList.remove("on");
    if (r.status === 429) { helper = { ...helper, left: 0, resets: r.resets }; renderAllow(); openSheet(); return; }
    if (!r.ok) { addMsg("bot", "I couldn't do that just now. Please try again."); return; }
    helper = { left: r.left, free: r.free, resets: r.resets }; renderAllow();
    const reply = rule[1](P.params, text); addMsg("bot", reply); P.asks = [...(P.asks || []), { q: text, a: reply }].slice(-20); draw(0); sparkles(); persist();
    if (helper.left <= 0) setTimeout(() => addMsg("bot", "That was your last free change for today. Your project is saved."), 600);
  }
  $("send").onclick = () => ask($("ask").value); $("ask").onkeydown = (e) => { if (e.key === "Enter") ask($("ask").value); };
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  $("mic").onclick = () => {
    if (!SR) { toast("Talking isn't supported in this browser. Please type instead."); return; }
    const r = new SR(); r.lang = "en-US"; r.interimResults = false; $("mic").classList.add("live");
    r.onresult = (e) => ask(e.results[0][0].transcript); r.onend = () => $("mic").classList.remove("live");
    r.onerror = () => { $("mic").classList.remove("live"); toast("I couldn't hear that. Try again?"); }; r.start();
  };
  function renderAllow() { const pct = (helper.left / helper.free) * 100 + "%"; ["meter1", "meter2"].forEach((k) => { const m = $(k); if (m) m.style.width = pct; }); $("left1").textContent = `${helper.left} / ${helper.free}`; $("left2").textContent = helper.left; }
  let cd; function openSheet() { $("sheet").classList.add("on"); const end = helper.resets ? new Date(helper.resets) : null;
    const tick = () => { const s = Math.max(0, Math.floor(((end ? end.getTime() : Date.now()) - Date.now()) / 1000)); $("countdown").textContent = [s / 3600, (s % 3600) / 60, s % 60].map((v) => String(Math.floor(v)).padStart(2, "0")).join(":"); };
    tick(); clearInterval(cd); cd = setInterval(tick, 1000); }
  $("closesheet").onclick = () => { $("sheet").classList.remove("on"); clearInterval(cd); };

  // ------------------------------------------------------------------ step 6: price, watch it print, add to the real cart
  function priceOf(p = P) { const m = D.models[p.model]; const active = m.zones.filter((z) => z !== m.textZone || p.text);
    const extra = Math.max(0, new Set(active.map((z) => p.colors[z])).size - 1);
    const lines = [[m.name, m.price]]; if (p.text) lines.push([`Name "${p.text}"`, D.addons.text]); if (p.pic) lines.push(["Picture", D.addons.image]);
    if (extra) lines.push([`${extra} extra colour${extra > 1 ? "s" : ""}`, extra * D.addons.extraColor]);
    if ((p.asks || []).length) lines.push([`Helper changes (${p.asks.length})`, "Free"]); lines.push(["Shipping (US)", "Free"]);
    return { lines, active, total: lines.reduce((t, l) => t + (typeof l[1] === "number" ? l[1] : 0), 0) }; }
  $("watch").onclick = () => { if (still) return; const svg = $("model"), bed = $("bed"), nz = $("nozzle"), L = 40; let n = 0, x = 0, dir = 1; svg.classList.add("printing"); bed.classList.add("printing-on");
    const set = () => { const top = 100 - (n / L) * 100; svg.style.setProperty("--top", top + "%"); nz.style.setProperty("--ny", 14 + top * 0.74 + "%"); $("layer").innerHTML = `Layer <b>${n} / ${L}</b>`; }; set();
    const t = setInterval(() => { x += dir * 20; if (x >= 100 || x <= 0) { dir *= -1; n++; set(); } nz.style.setProperty("--nx", 12 + Math.max(0, Math.min(100, x)) * 0.76 + "%");
      if (n >= L) { clearInterval(t); setTimeout(() => { bed.classList.remove("printing-on"); svg.classList.remove("printing"); $("layer").innerHTML = "<b>Printed ✓</b>"; }, 300); } }, 22); };
  $("printbtn").onclick = () => {
    const m = M(P), pr = priceOf(), colors = Object.fromEntries(pr.active.map((z) => [z, P.colors[z]]));
    const changes = (P.asks || []).map((a) => a.q).join("; ");
    const note = [`Playground: letters ${FONT_NAMES[P.font] || "Bubbly"}`, changes && `asked the helper: ${changes}`].filter(Boolean).join(" · ").slice(0, 200);
    const colorStr = pr.active.length > 1 ? pr.active.map((z) => `${z}: ${colors[z]}`).join(" · ") : colors[pr.active[0]];
    const line = { slug: P.model, name: m.name, photo: m.photo, qty: 1, colors, colorRequest: note, text: P.text || null, uploadUrl: P.pic || null, uploadName: P.picName || null,
      unitCents: Math.round(pr.total * 100), summary: [`Color: ${colorStr}`, P.text && `Text: "${P.text}"`, P.pic && `Picture: ${P.picName || "uploaded"}`, note].filter(Boolean).join(" · ") };
    try { const KEY = "hardys3d-cart", items = JSON.parse(localStorage.getItem(KEY) || "[]"); items.push({ ...line, id: `${line.slug}-${Date.now().toString(36)}` }); localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
    P.status = "ordered"; clearTimeout(saveT); confetti(); toast("In your cart! Taking you there…");
    Promise.all([api("projects", P), new Promise((r) => setTimeout(r, still ? 300 : 1400))]).then(() => (location.href = "/cart"));
  };

  // ------------------------------------------------------------------ the drawing (studio preview and project thumbnails)
  function letters(t, x, y, size, fill, font, anim) { return `<text x="${x}" y="${y}" text-anchor="middle" font-family="${font}" font-weight="900" font-size="${size}" fill="${fill}" stroke="rgba(0,0,0,.25)" stroke-width="1"${font.includes("Georgia") ? ' font-style="italic"' : ""}>` +
    [...t].map((ch, i) => `<tspan class="${anim ? "letter" : ""}" style="animation-delay:${i * 0.06}s">${esc(ch)}</tspan>`).join("") + `</text>`; }
  function pattern(kindP, x, y, w, h, col) { if (!kindP || kindP === "none") return ""; let out = ""; const cols = 6, rows = 4;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const px = x + (w * (c + 0.5 + (r % 2 ? 0.5 : 0))) / cols, py = y + (h * (r + 0.5)) / rows; if (px > x + w - 8) continue;
      out += kindP === "stars" ? `<path d="M${px} ${py - 7} l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1z" fill="${col}" opacity=".55"/>` :
        kindP === "hearts" ? `<path d="M${px} ${py + 5} c-9 -6 -7 -13 -2 -13 c1 0 2 1 2 2 c0 -1 1 -2 2 -2 c5 0 7 7 -2 13z" fill="${col}" opacity=".55"/>` : `<circle cx="${px}" cy="${py}" r="4" fill="${col}" opacity=".5"/>`; } return out; }
  function drawSVG(p, thumb = false, anim = 0) {
    const m = D.models[p.model], c = p.colors, k = p.params || {}, font = FONTS[p.font] || "Nunito", t = p.text || "", K = KIND[p.model] || "lunchbox";
    const tz = m.textZone, col = (z) => hex(c[z] || c[m.zones[0]]);
    const S = k.size || 1, cx = 200, cy = 172; let g = `<ellipse cx="200" cy="322" rx="${150 * S}" ry="14" fill="rgba(120,70,40,.12)"/><g transform="translate(${cx} ${cy}) scale(${S}) translate(${-cx} ${-cy})">`;
    const img = (x, y, w, h) => (p.pic ? `<image class="${anim === 4 ? "stamp" : ""}" href="${esc(p.pic)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>` : "");
    if (K === "lunchbox") { const r = k.corner || 28, hs = k.handle || 1;
      g += `<rect class="part" x="58" y="84" width="284" height="222" rx="${r}" fill="${col("Box")}" stroke="rgba(0,0,0,.18)"/>
        <rect x="58" y="282" width="284" height="24" rx="12" fill="rgba(0,0,0,.12)"/>
        ${Array.from({ length: 9 }, (_, i) => `<rect x="${92 + i * 26}" y="288" width="14" height="9" rx="2" fill="rgba(0,0,0,.25)"/>`).join("")}
        <path d="M${200 - 34 * hs} 64 q${34 * hs} ${-40 * hs} ${68 * hs} 0" fill="none" stroke="${col("Box")}" stroke-width="${12 * Math.min(1.3, hs)}" stroke-linecap="round"/>
        <rect class="part" x="48" y="62" width="304" height="214" rx="${r + 2}" fill="${col("Lid")}" stroke="rgba(0,0,0,.2)"/>
        ${pattern(k.pattern, 60, 74, 280, 190, "#fff")}${img(130, 86, 140, 92)}
        ${t ? letters(t, 200, p.pic ? 232 : 188, (p.pic ? 38 : 50) * (k.textSize || 1), col(tz), font, anim === 3) : ""}
        ${!t && !p.pic && !thumb ? `<text x="200" y="180" text-anchor="middle" font-family="DM Sans" font-size="15" fill="rgba(255,255,255,.85)">your name and picture go here</text>` : ""}`; }
    else if (K === "ruler") { const r = Math.min(30, (k.corner || 28) * 0.6);
      g += `<rect class="part" x="28" y="120" width="344" height="104" rx="${r}" fill="${col("Body")}" stroke="rgba(0,0,0,.18)"/>${pattern(k.pattern, 40, 150, 320, 50, "#fff")}
        ${Array.from({ length: 33 }, (_, i) => `<rect x="${44 + i * 10}" y="120" width="2.4" height="${i % 5 ? 12 : 22}" fill="${col("Markings")}" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>`).join("")}
        ${Array.from({ length: 13 }, (_, i) => `<rect x="${44 + i * 26}" y="${224 - (i % 2 ? 12 : 20)}" width="2.4" height="${i % 2 ? 12 : 20}" fill="${col("Markings")}" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>`).join("")}
        ${img(46, 150, 64, 44)}${t ? letters(t, p.pic ? 232 : 200, 186, 28 * (k.textSize || 1), col(tz), font, anim === 3) : ""}`; }
    else { const r = Math.min(30, (k.corner || 28) * 0.6);
      g += `<path class="part" fill-rule="evenodd" fill="${col("Body")}" stroke="rgba(0,0,0,.18)" d="M${60 + r} 110 H${340 - r} Q340 110 340 ${110 + r} V${240 - r} Q340 240 ${340 - r} 240 H${60 + r} Q60 240 60 ${240 - r} V${110 + r} Q60 110 ${60 + r} 110 Z M118 110 Q200 196 282 110 Z"/>
        ${pattern(k.pattern, 70, 170, 260, 60, "#fff")}
        ${Array.from({ length: 11 }, (_, i) => `<rect x="${78 + i * 25}" y="${240 - (i % 2 ? 10 : 18)}" width="2.4" height="${i % 2 ? 10 : 18}" fill="${col("Markings")}" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>`).join("")}
        <circle cx="84" cy="134" r="6" fill="rgba(0,0,0,.35)"/>${img(252, 168, 70, 44)}
        ${t ? letters(t, p.pic ? 160 : 200, 210, 24 * (k.textSize || 1), col(tz), font, anim === 3) : ""}`; }
    g += "</g>"; return thumb ? `<svg viewBox="0 0 400 344">${g}</svg>` : g;
  }
  function draw(anim) {
    $("model").innerHTML = drawSVG(P, false, anim);
    const bed = $("bed"); if (anim === 1 && !still) { bed.classList.remove("anim-drop"); void bed.offsetWidth; bed.classList.add("anim-drop"); }
    const pr = priceOf(); $("pprice").textContent = "$" + pr.total.toFixed(2); $("pprice").classList.add("bump"); setTimeout(() => $("pprice").classList.remove("bump"), 260);
    $("printbtn").textContent = `Print it · $${pr.total.toFixed(2)}`;
    $("bill").innerHTML = pr.lines.map(([a, b]) => `<div><span>${esc(a)}</span><b>${typeof b === "number" ? "$" + b.toFixed(2) : b}</b></div>`).join("") + `<div class="tot"><span>Total</span><b>$${pr.total.toFixed(2)}</b></div>` +
      ((P.asks || []).length ? `<p class="small" style="margin-top:10px">Hardy checks the helper's changes and makes them by hand before he prints.</p>` : "");
    $("pdesc").innerHTML = `<b>${esc(M(P).name)}</b> · about ${M(P).hours} h to print`; $("layer").textContent = ""; persist();
  }

  // ------------------------------------------------------------------ little effects
  function fx(make, n) { if (still) return; const box = $("fx"); for (let i = 0; i < n; i++) { const e = make(i); box.appendChild(e); setTimeout(() => e.remove(), 1500); } }
  function splash(col) { fx(() => { const e = document.createElement("span"); e.className = "splash"; e.style.background = col; return e; }, 1);
    fx((i) => { const e = document.createElement("span"); e.className = "drip"; e.style.background = col; const a = (i / 8) * 6.28; e.style.left = "50%"; e.style.top = "50%"; e.style.setProperty("--dx", Math.cos(a) * 150 + "px"); e.style.setProperty("--dy", Math.sin(a) * 120 + "px"); return e; }, 8); }
  function sparkles() { fx((i) => { const e = document.createElement("span"); e.className = "spark"; e.style.left = 20 + Math.random() * 60 + "%"; e.style.top = 20 + Math.random() * 55 + "%";
    e.style.setProperty("--dx", Math.random() * 80 - 40 + "px"); e.style.setProperty("--dy", Math.random() * -80 + "px"); if (i % 3 === 1) e.style.background = "#02848d"; return e; }, 12); }
  function puffs() { fx((i) => { const e = document.createElement("span"); e.className = "puff"; const a = (i / 7) * 6.28; e.style.left = "calc(50% - 13px)"; e.style.top = "38%"; e.style.setProperty("--dx", Math.cos(a) * 110 + "px"); e.style.setProperty("--dy", Math.sin(a) * 60 + "px"); return e; }, 7); }
  function confetti() { const cols = ["#f8991d", "#02848d", "#032859", "#f9c9d4", "#ffcf9e"]; fx((i) => { const e = document.createElement("span"); e.className = "confetti"; e.style.background = cols[i % 5]; e.style.left = "50%"; e.style.top = "40%";
    e.style.setProperty("--dx", Math.random() * 500 - 250 + "px"); e.style.setProperty("--dy", Math.random() * 320 - 200 + "px"); return e; }, 40); }

  // the sign-in screen: a little nozzle prints "Life is your creation." layer by layer
  function gatePrint() {
    const w = $("g-word"), g = $("g-gantry"), nz = $("g-nozzle"), L = 60; if (!w || w.dataset.done) return; w.dataset.done = 1;
    const set = (k) => { const top = 100 - (k / L) * 100; w.style.setProperty("--top", top + "%"); g.style.setProperty("--gy", 56 + (top / 100) * w.offsetHeight + "px"); };
    if (still) { set(L); g.style.setProperty("--gy", "8px"); nz.style.setProperty("--nx", "100%"); return; }
    let k = 0, dir = 1, x = 0; set(0);
    const t = setInterval(() => { x += dir * 25; if (x >= 100 || x <= 0) { dir *= -1; x = Math.max(0, Math.min(100, x)); k++; set(k); } nz.style.setProperty("--nx", x + "%");
      if (k >= L) { clearInterval(t); setTimeout(() => { g.style.transition = "top .8s ease-in"; g.style.setProperty("--gy", "8px"); nz.style.setProperty("--nx", "100%"); }, 300); } }, 28);   // the head parks at the top right, done
  }
  start();
})();
