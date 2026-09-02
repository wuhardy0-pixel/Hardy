from __future__ import annotations
from flask import Flask, request, jsonify, send_from_directory, session, redirect
from pathlib import Path
from datetime import timedelta
import os, io, re, sqlite3, json, hashlib, base64, datetime, uuid, hmac, secrets, time, threading, html

# Load API keys from .env (server-side only — never sent to the browser).
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

BASE = Path(__file__).resolve().parent
# Lasting data (books, evidence, backups, visitor log). On a hosting service this
# points at the mounted volume so it survives redeploys; locally it's this folder.
DATA_DIR = Path(os.environ.get("BOOKKEEP_DATA_DIR") or BASE)
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB = DATA_DIR / "bookkeep_v13.db"
FILES = DATA_DIR / "evidence_files_v13"
FILES.mkdir(exist_ok=True)

app = Flask(__name__, static_folder=None)
# Behind Caddy/Railway/Cloudflare the real client address and scheme arrive in
# X-Forwarded-* headers; without this every visitor would look like 127.0.0.1.
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
# Sign in once, anywhere on hardywu.com (login<thing>.hardywu.com, books., the
# site itself) and stay signed in everywhere: the cookie is shared across the domain.
from flask.sessions import SecureCookieSessionInterface
class _SharedCookie(SecureCookieSessionInterface):
    def get_cookie_domain(self, app):
        h = (request.host or "").split(":")[0].lower()
        return ".hardywu.com" if h.endswith("hardywu.com") else None
app.session_interface = _SharedCookie()

# ===================== FAMILY LOGIN (name only, no password) =====================
# Remote visitors (tunnel/public URL) just say WHO they are — no password, by
# the owner's choice. The name is remembered for 90 days and the app opens that
# person's profile. Access from the Mac itself is exempt entirely.

def ensure_env_secret(name, make_value):
    val = os.environ.get(name, "").strip()
    if val:
        return val
    val = make_value()
    try:
        with open(BASE / ".env", "a") as f:
            f.write(f"\n{name}={val}\n")
    except OSError:
        pass                      # read-only container: the value lives in the environment
    os.environ[name] = val
    return val

app.secret_key = ensure_env_secret("BOOKKEEP_SECRET", lambda: secrets.token_hex(32))
app.permanent_session_lifetime = timedelta(days=90)


# ===================== HARDYWU.COM — THE COMPANY SITE =====================
# hardywu.com / www = public portfolio (home + sections + product pages).
# books.hardywu.com = the BookKeep app (login-gated as before).
# URL pattern: hardywu.com/<section>/<thing>  e.g. /apps/bookkeep, /3d/crab-gauge.
PORTFOLIO_HOSTS = {"hardywu.com", "www.hardywu.com"}
APP_HOST = "https://books.hardywu.com"

PORTFOLIO = {
    "apps": {"title": "Apps", "emoji": "📱", "blurb": "Software built by Hardy Wu.",
        "items": {
            "bookkeep": {"name": "BookKeep", "emoji": "📒", "redirect": APP_HOST, "img": "/item/bookkeep.jpg",
                "desc": "An AI bookkeeper you can talk to — double-entry accounting, evidence, statements, and margins."},
        }},
    "games": {"title": "Video Games", "emoji": "🎮", "blurb": "Games built by Hardy Wu — play them free.",
        "items": {
            "football-sim": {"name": "Football Sim", "emoji": "⚽", "img": "/item/footballsim.jpg",
                "desc": "An original 3D football simulation — broadcast-style play, fictional clubs and stadiums.",
                "link": "/play/fifa/", "link_label": "▶ Play in your browser"},
            "nova-blast": {"name": "Nova Blast", "emoji": "🚀", "img": "/item/nova.jpg",
                "desc": "A neon space shooter — waves of raiders, asteroids, power-ups and a boss every fifth wave.",
                "link": "/play/nova", "link_label": "▶ Play in your browser"},
            "critter-quest": {"name": "Critter Quest", "emoji": "⚡", "img": "/item/quest.jpg",
                "desc": "Four regions, a town with a shop and healer, MP-powered special moves — 32 critters to catch and evolve, ranked F to SSS.",
                "link": "/play/quest", "link_label": "▶ Play in your browser"},
            "nova-strike": {"name": "Nova Strike", "emoji": "🚀", "img": "/item/novastrike.jpg",
                "desc": "A fast-paced space shooter on itch.io.",
                "link": "https://hardywu.itch.io/ns", "link_label": "▶ Play on itch.io"},
            "pokemon-adventure": {"name": "Pokémon Adventure", "emoji": "⚡", "img": "/item/pokemonadv.jpg",
                "desc": "An adventure through a world of creatures to catch and battle, on itch.io.",
                "link": "https://hardywu.itch.io/pa", "link_label": "▶ Play on itch.io"},
        }},
    "3d": {"title": "3D", "emoji": "🖨️",
        "blurb": "The 3D print store — pick your colors and see it before you buy.",
        "items": {}},  # filled from the shop catalog below
    "robotics": {"title": "Robotics", "emoji": "🤖", "blurb": "Robot projects. Coming soon.",
        "items": {}},
}

# Real catalog from Hardy's 3D Business (names, prices, photos).
SHOP_DIR = BASE.parent / "Hardy's 3D Business" / "app"
try:
    _cat = json.loads((SHOP_DIR / "data" / "catalog.json").read_text())
except Exception:
    _cat = {"products": [], "colors": []}
SHOP_COLORS = [c.get("name") for c in _cat.get("colors", [])]
SHOP_PRODUCTS = {p["slug"]: p for p in _cat.get("products", [])}
_EMOJI = {"crab-gauge": "🦀", "customizable-lunchbox": "🍱", "dual-ruler": "📏"}
for _slug, _p in SHOP_PRODUCTS.items():
    PORTFOLIO["3d"]["items"][_slug] = {
        "name": _p["name"], "emoji": _EMOJI.get(_slug, "🖨️"),
        "desc": f'{_p.get("description","")} — ${_p["price"]:.2f}',
        "shop": True, "price": float(_p["price"]),
        "photo": (_p.get("photos") or [None])[0],
    }

@app.get("/products/<path:name>")
def shop_photo(name):
    return send_from_directory(SHOP_DIR / "public" / "products", name)

@app.post("/api/order")
def place_order():
    x = request.get_json(force=True)
    slug = str(x.get("product") or "")
    p = SHOP_PRODUCTS.get(slug)
    if not p:
        return jsonify(error="Unknown product."), 400
    try:
        qty = int(x.get("qty") or 0)
    except (TypeError, ValueError):
        qty = 0
    if not (1 <= qty <= 99):
        return jsonify(error="Quantity must be between 1 and 99."), 400
    buyer = str(x.get("buyer") or "").strip()[:60]
    if not buyer:
        return jsonify(error="Please tell us your name."), 400
    color = str(x.get("color") or "").strip()[:40]
    if color and color not in SHOP_COLORS:
        return jsonify(error="Unknown color."), 400
    custom = str(x.get("custom") or "").strip()[:80]
    total = round(float(p["price"]) * qty, 2)
    oid = "O_" + uuid.uuid4().hex[:10]
    con = db()
    con.execute("""INSERT INTO orders(id,product,product_name,qty,price_each,total,color,custom_text,buyer,status,created_at)
                   VALUES(?,?,?,?,?,?,?,?,?,'new',?)""",
                (oid, slug, p["name"], qty, float(p["price"]), total, color, custom, buyer, now_iso()))
    con.commit(); con.close()
    return jsonify(ok=True, order=oid, total=total, name=p["name"])

@app.post("/api/order/from-shop")
def order_from_shop():
    if not is_local_request():
        return jsonify(error="Internal only."), 403
    x = request.get_json(force=True)
    oid = "O_" + uuid.uuid4().hex[:10]
    con = db()
    con.execute("""INSERT INTO orders(id,product,product_name,qty,price_each,total,color,custom_text,buyer,status,created_at)
                   VALUES(?,?,?,?,?,?,?,?,?,'new',?)""",
                (oid, str(x.get("product") or "")[:60], str(x.get("product_name") or "")[:80],
                 int(x.get("qty") or 1), float(x.get("price_each") or 0), float(x.get("total") or 0),
                 "", str(x.get("details") or "")[:300], str(x.get("buyer") or "Online customer")[:60], now_iso()))
    con.commit(); con.close()
    return jsonify(ok=True, order=oid)

@app.get("/api/orders")
def list_orders():
    if not is_owner():
        return jsonify(error="Only the creator can see orders."), 403
    con = db()
    rows = [dict(r) for r in con.execute("SELECT * FROM orders WHERE status='new' ORDER BY created_at")]
    con.close()
    return jsonify(orders=rows)

@app.post("/api/orders/update")
def update_order():
    if not is_owner():
        return jsonify(error="Only the creator can update orders."), 403
    x = request.get_json(force=True)
    oid = str(x.get("id") or "")
    status = str(x.get("status") or "")
    if status not in ("booked", "dismissed"):
        return jsonify(error="Bad status."), 400
    con = db()
    cur = con.execute("UPDATE orders SET status=? WHERE id=?", (status, oid))
    con.commit(); con.close()
    if not cur.rowcount:
        return jsonify(error="No such order."), 404
    return jsonify(ok=True)

# ============================ visitor sign-in & activity =====================
# Everyone who visits hardywu.com signs in with a name and email first. Hardy
# (the owner) can then see who came, what they looked at, how long they stayed
# and what they clicked, at /activity.
HARDY_EMAIL = "wuhardy0@gmail.com"
ACT_FILE = DATA_DIR / "activity.json"
_act_lock = threading.Lock()

def _act_load():
    try:
        return json.loads(ACT_FILE.read_text())
    except Exception:
        return {"people": {}}

def _act_save(data):
    tmp = ACT_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1))
    tmp.replace(ACT_FILE)

def friendly_label(path):
    """Turn a URL into something a person can read."""
    p = (path or "/").split("?")[0].rstrip("/") or "/"
    if p == "/":
        return "Home page"
    if p == "/activity":
        return "Activity report"
    if p.startswith("/play/"):
        slug = p.split("/play/")[1].strip("/")
        return {"nova": "Playing Nova Blast", "quest": "Playing Critter Quest",
                "fifa": "Playing Football Sim"}.get(slug, "Playing " + slug)
    parts = [x for x in p.split("/") if x]
    if len(parts) == 1 and parts[0] in PORTFOLIO:
        return PORTFOLIO[parts[0]]["title"]
    if len(parts) == 2 and parts[0] in PORTFOLIO:
        item = PORTFOLIO[parts[0]].get("items", {}).get(parts[1])
        return item["name"] if item else parts[1].replace("-", " ").title()
    return p

def visitor():
    em = (session.get("v_email") or "").strip().lower()
    return em or None

def track(kind, label, path, seconds=0, detail=""):
    em = visitor()
    if not em:
        return
    with _act_lock:
        data = _act_load()
        who = data["people"].setdefault(em, {
            "name": session.get("v_name") or "", "email": em,
            "first_seen": now_iso(), "last_seen": now_iso(),
            "total_seconds": 0, "activities": {}, "clicks": [], "visits": 0})
        who["name"] = session.get("v_name") or who.get("name") or ""
        who["last_seen"] = now_iso()
        if kind == "view":
            who["visits"] = who.get("visits", 0) + 1
        if seconds:
            secs = max(0, min(120, int(seconds)))          # one beat can't claim more than 2 min
            who["total_seconds"] = who.get("total_seconds", 0) + secs
            a = who["activities"].setdefault(label, {"seconds": 0, "opens": 0, "path": path})
            a["seconds"] += secs
        if kind == "view":
            a = who["activities"].setdefault(label, {"seconds": 0, "opens": 0, "path": path})
            a["opens"] = a.get("opens", 0) + 1
        if kind == "click":
            who["clicks"].append({"at": now_iso(), "what": detail or label,
                                  "where": friendly_label(path), "path": path})
            who["clicks"] = who["clicks"][-400:]           # keep the most recent trail
        _act_save(data)

VISITOR_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>Welcome — hardywu.com</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="/favicon.png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:#03102c}
body{font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#fff;
 display:grid;place-items:center;padding:28px;text-align:center;
 background:radial-gradient(1200px 700px at 50% -10%,#1b58c9 0%,rgba(27,88,201,0) 60%),
  radial-gradient(900px 600px at 85% 20%,#0e7fd6 0%,rgba(14,127,214,0) 55%),
  linear-gradient(180deg,#04102e 0%,#061a44 45%,#03102c 100%);background-attachment:fixed}
.card{width:min(460px,100%);background:rgba(9,28,66,.6);border:1px solid rgba(96,165,250,.3);
 border-radius:22px;padding:32px 26px;backdrop-filter:blur(10px);box-shadow:0 14px 50px rgba(2,12,35,.5)}
img.logo{width:92px;height:92px;border-radius:20px}
h1{font-size:clamp(30px,7vw,46px);font-weight:900;font-style:italic;text-transform:uppercase;
 letter-spacing:-.045em;line-height:.95;margin:16px 0 6px}
p{color:rgba(255,255,255,.82);font-size:15px;line-height:1.55;margin:8px 0}
input{font:inherit;font-size:17px;padding:15px 16px;border-radius:14px;border:1px solid rgba(96,165,250,.4);
 background:rgba(3,16,44,.75);color:#fff;width:100%;margin:9px 0;text-align:center}
input:focus{outline:none;border-color:#38bdf8}
button{font:inherit;font-weight:800;font-size:19px;padding:15px 30px;margin-top:14px;border:0;border-radius:14px;
 width:100%;cursor:pointer;background:linear-gradient(135deg,#2563eb,#38bdf8);color:#fff;
 box-shadow:0 10px 28px rgba(56,189,248,.4)}
.err{color:#fca5a5;min-height:20px;font-size:14px;font-weight:700;margin-top:8px}
.small{color:rgba(255,255,255,.6);font-size:12.5px;margin-top:16px}
</style></head><body>
<div class="card">
 <img class="logo" src="/logo.png" alt="Hardy Wu">
 <h1>Try New<br>Things.</h1>
 <p>Welcome to <b>hardywu.com</b> — apps, video games, 3D prints and robots.<br>Tell us who you are to come in.</p>
 <input id="nm" autofocus placeholder="Your name" autocomplete="name" maxlength="60">
 <input id="em" type="email" placeholder="Your email" autocomplete="email" maxlength="90">
 <div class="err" id="err"></div>
 <button onclick="go()">Enter the site →</button>
 <p class="small">We keep your name and email so Hardy knows who visited. Nothing is shared with anyone else.</p>
</div>
<script>
async function go(){
  const r=await fetch("/api/visitor",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name:nm.value,email:em.value,next:location.pathname+location.search})});
  const j=await r.json().catch(()=>({}));
  if(r.ok){location.href=j.next||"/";}else{err.textContent=j.error||"Please fill in both.";}
}
for(const el of [nm,em])el.addEventListener("keydown",e=>{if(e.key==="Enter")go();});
</script></body></html>"""

@app.post("/api/visitor")
def visitor_login():
    d = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()[:60]
    email = (d.get("email") or "").strip().lower()[:90]
    if not name:
        return jsonify(error="Please type your name."), 400
    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify(error="Please type a real email address."), 400
    session.permanent = True
    session["v_name"] = name
    session["v_email"] = email
    nxt = (d.get("next") or "/").strip()
    if not nxt.startswith("/") or nxt.startswith("//"):
        nxt = "/"
    key = login_slug_from_host()
    if key is not None and key in login_targets():        # the server decides where a login address leads
        nxt = dest(login_targets()[key])
        track("open", login_targets()[key]["name"], nxt)
    else:
        track("view", friendly_label(nxt), nxt)
    return jsonify(ok=True, next=nxt)

@app.get("/signout")
def visitor_signout():
    session.pop("v_name", None); session.pop("v_email", None)
    return redirect("/")

@app.post("/api/track")
def api_track():
    if not visitor():
        return jsonify(ok=False), 204
    d = request.get_json(silent=True) or {}
    path = (d.get("path") or "/")[:200]
    label = friendly_label(path)
    secs = d.get("seconds") or 0
    if secs:
        track("time", label, path, seconds=secs)
    for c in (d.get("clicks") or [])[:25]:
        track("click", label, path, detail=str(c.get("what") or "")[:80])
    return jsonify(ok=True)

TRACK_JS = """(function(){
 var path=location.pathname, last=Date.now(), clicks=[], sent=0;
 function beat(final){
   var now=Date.now(), secs=Math.round((now-last)/1000); last=now;
   if(secs>120)secs=120;                       // a sleeping tab doesn't count
   if(!secs&&!clicks.length&&sent)return;
   var body=JSON.stringify({path:path,seconds:secs,clicks:clicks.splice(0,25)});
   sent=1;
   if(final&&navigator.sendBeacon){navigator.sendBeacon("/api/track",new Blob([body],{type:"application/json"}));}
   else{fetch("/api/track",{method:"POST",headers:{"Content-Type":"application/json"},body:body,keepalive:true}).catch(function(){});}
 }
 setInterval(function(){if(!document.hidden)beat(false);},15000);
 document.addEventListener("visibilitychange",function(){beat(document.hidden);});
 addEventListener("pagehide",function(){beat(true);});
 addEventListener("click",function(e){
   var t=e.target;while(t&&t!==document.body&&!t.matches("a,button,.card,.pick,[data-track]"))t=t.parentElement;
   if(!t||t===document.body)return;
   var head=t.querySelector&&t.querySelector("h1,h2,h3,b");
   var what=(t.getAttribute("data-track")||(head&&head.textContent)||t.textContent||"")
            .trim().replace(/\s+/g," ").slice(0,44);
   var href=t.getAttribute&&t.getAttribute("href");
   clicks.push({what:what||href||"(clicked)"});
   if(clicks.length>=6)beat(false);
 },true);
})();"""

@app.get("/track.js")
def track_js():
    return _nocache(app.response_class(TRACK_JS, mimetype="application/javascript"))

def fmt_dur(sec):
    sec = int(sec or 0)
    if sec < 60:
        return f"{sec} sec"
    if sec < 3600:
        m, s = divmod(sec, 60)
        return f"{m} min" + (f" {s} sec" if s else "")
    h, rem = divmod(sec, 3600)
    m = rem // 60
    return f"{h} hr" + (f" {m} min" if m else "")

def is_hardy():
    return visitor() == HARDY_EMAIL or (session.get("v_email") or "").lower() == HARDY_EMAIL

@app.get("/activity")
def activity_page():
    if not is_portfolio_host() and not is_local_request():
        return redirect("/")
    if not is_hardy():
        return p_page("Activity", """<header><h1>Just for Hardy</h1>
          <p class="tag">Sign in as Hardy Wu to see who has visited.</p></header>""",
          '<a href="/">← hardywu.com</a>'), 403
    data = _act_load()
    people = sorted(data.get("people", {}).values(),
                    key=lambda p: p.get("last_seen") or "", reverse=True)
    if not people:
        rows = '<p class="tag">Nobody has signed in yet.</p>'
    else:
        rows = ""
        for p in people:
            acts = sorted(p.get("activities", {}).items(),
                          key=lambda kv: kv[1].get("seconds", 0), reverse=True)
            act_rows = "".join(
                f'<tr><td>{html.escape(k)}</td><td class="n">{fmt_dur(v.get("seconds",0))}</td>'
                f'<td class="n">{v.get("opens",0)}</td></tr>' for k, v in acts) or \
                '<tr><td colspan="3" class="muted">nothing yet</td></tr>'
            clicks = list(reversed(p.get("clicks", [])))[:40]
            click_rows = "".join(
                f'<li><b>{html.escape(c.get("what",""))}</b> '
                f'<span class="muted">on {html.escape(c.get("where",""))} · '
                f'{html.escape((c.get("at") or "")[:16].replace("T"," "))}</span></li>'
                for c in clicks) or '<li class="muted">no clicks recorded yet</li>'
            rows += f"""
<div class="person">
  <div class="who"><div class="nm">{html.escape(p.get("name") or "(no name)")}</div>
    <div class="em">{html.escape(p.get("email",""))}</div></div>
  <div class="stat"><div class="big">{fmt_dur(p.get("total_seconds",0))}</div>
    <div class="muted">total time on the site</div>
    <div class="muted">{p.get("visits",0)} page opens · last seen {html.escape((p.get("last_seen") or "")[:16].replace("T"," "))}</div></div>
  <table><tr><th>What they did</th><th class="n">Time</th><th class="n">Opens</th></tr>{act_rows}</table>
  <details><summary>Clicks ({len(p.get("clicks", []))})</summary><ul>{click_rows}</ul></details>
</div>"""
    body = f"""<header><h1>Who came to visit</h1>
      <p class="tag">Everyone who signed in, what they did, and how long they stayed.</p></header>
      <div class="wrap">{rows}</div>"""
    extra = """<style>
.wrap{max-width:900px;margin:10px auto 40px;padding:0 18px;text-align:left}
.person{background:rgba(9,28,66,.55);border:1px solid rgba(96,165,250,.28);border-radius:18px;
 padding:20px;margin:16px 0;backdrop-filter:blur(10px)}
.who .nm{font-weight:900;font-style:italic;text-transform:uppercase;font-size:22px;letter-spacing:-.03em}
.who .em{color:#7dd3fc;font-size:14px;font-weight:600}
.stat{margin:12px 0 6px}.stat .big{font-size:26px;font-weight:900;font-style:italic}
.muted{color:rgba(255,255,255,.6);font-size:13px}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:14.5px}
th,td{padding:8px 6px;border-bottom:1px solid rgba(96,165,250,.18);text-align:left}
th{color:rgba(255,255,255,.7);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
td.n,th.n{text-align:right;white-space:nowrap}
details{margin-top:12px}summary{cursor:pointer;font-weight:700;color:#7dd3fc;font-size:14px}
details ul{margin:10px 0 0;padding-left:18px;font-size:13.5px;line-height:1.7}
</style>"""
    return p_page("Activity — hardywu.com", extra + body, '<a href="/">← hardywu.com</a>')

SITE_PORT = 5001          # http://127.0.0.1:5001 = the hardywu.com site, locally

SITE_ORIGIN = "https://hardywu.com"
def _key(slug): return re.sub(r"[^a-z0-9]", "", str(slug).lower())

def login_targets():
    """Every button that leaves the site gets its own login address:
    loginnovablast.hardywu.com → /play/nova, loginbookkeep.hardywu.com → BookKeep, …"""
    t = {}
    for sec, sdef in PORTFOLIO.items():
        for slug, it in sdef.get("items", {}).items():
            if it.get("redirect"): to = it["redirect"]
            elif it.get("link"):   to = it["link"]          # relative links stay relative (see dest())
            else: continue
            t[_key(slug)] = {"name": it["name"], "to": to, "slug": slug}
    t["3d"] = {"name": "The 3D store", "to": SHOP_HOST, "slug": "3d"}
    t[""]   = {"name": "hardywu.com", "to": SITE_ORIGIN + "/", "slug": ""}
    return t

def dest(tgt):
    """Where a login leads: absolute on the live domain, local on this Mac."""
    to = tgt["to"]
    if to.startswith("http"): return to
    return SITE_ORIGIN + to if on_real_site() else to

def login_slug_from_host():
    m = re.match(r"^login([a-z0-9]*)\.hardywu\.com$", (request.host or "").split(":")[0].lower())
    return m.group(1) if m else None

def on_real_site():
    return (request.host or "").split(":")[0].lower().endswith("hardywu.com")

def login_url_for(key):
    """The login page for one thing — a real subdomain live, a plain path on this Mac."""
    return f"https://login{key}.hardywu.com/" if on_real_site() else f"/go/{key or 'home'}"

PLAY_KEYS = {"/play/nova": "novablast", "/play/quest": "critterquest", "/play/fifa": "footballsim"}
def play_key(path):
    for pre, k in PLAY_KEYS.items():
        if path == pre or path.startswith(pre + "/"): return k
    return ""

def is_portfolio_host():
    if login_slug_from_host() is not None:
        return True
    host = (request.host or "").lower()
    if host.split(":")[0] in PORTFOLIO_HOSTS:
        return True
    return host.endswith(f":{SITE_PORT}")

def p_page(title, body, crumbs=""):
    nav = "".join(f'<a href="/{k}">{v["emoji"]} {v["title"]}</a>' for k, v in PORTFOLIO.items())
    if visitor():
        who = (f'signed in as <b>{html.escape(session.get("v_name") or "")}</b> '
               f'({html.escape(visitor())}) · <a href="/signout">sign out</a>')
        if is_hardy():
            who += ' · <a href="/activity">📊 see who visited</a>'
    else:
        who = ""
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>{title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
<style>
html{{background:#03102c}}
body{{font-family:"Inter",-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Roboto,sans-serif;
  color:#fff;margin:0;text-align:center;min-height:100vh;-webkit-font-smoothing:antialiased;letter-spacing:-0.01em;
  background:radial-gradient(1200px 700px at 50% -10%,#1b58c9 0%,rgba(27,88,201,0) 60%),
             radial-gradient(900px 600px at 85% 20%,#0e7fd6 0%,rgba(14,127,214,0) 55%),
             radial-gradient(900px 700px at 10% 80%,#0b3f9e 0%,rgba(11,63,158,0) 60%),
             linear-gradient(180deg,#04102e 0%,#061a44 45%,#03102c 100%);
  background-attachment:fixed}}
header{{padding:34px 20px 10px}}
h1{{margin:10px 0;font-size:clamp(34px,6vw,58px);font-weight:900;font-style:italic;text-transform:uppercase;
  letter-spacing:-0.04em;line-height:.95;color:#fff}} .tag{{color:#9aa4bd}}
nav{{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;padding:14px}}
nav a,a.btn{{background:rgba(12,34,78,.55);border:1px solid rgba(96,165,250,.35);color:#fff;text-decoration:none;padding:14px 26px;border-radius:14px;font-weight:800;font-size:16px;letter-spacing:-0.01em;backdrop-filter:blur(8px)}}
nav a:hover,a.btn:hover{{background:rgba(23,60,130,.7);border-color:#60a5fa}}
.cards{{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px;max-width:1000px;margin:24px auto;padding:0 20px}}
.card{{background:rgba(9,28,66,.55);border:1px solid rgba(96,165,250,.28);border-radius:18px;padding:22px 18px;text-decoration:none;color:#eaf3ff;
  backdrop-filter:blur(10px);box-shadow:0 8px 30px rgba(2,12,35,.45);transition:transform .15s,border-color .15s,box-shadow .15s}}
.card:hover{{border-color:#38bdf8;transform:translateY(-4px);box-shadow:0 14px 40px rgba(56,189,248,.28)}}
.card .big{{font-size:44px}}
.card h2{{margin:14px 0 6px;font-weight:900;font-style:italic;text-transform:uppercase;font-size:21px;
  letter-spacing:-0.035em;color:#fff}}
.card p{{color:rgba(255,255,255,.8);margin:0;font-size:14px;line-height:1.5}}
.tag{{color:rgba(255,255,255,.88);font-size:17px;font-weight:500}}
.crumbs{{color:rgba(255,255,255,.7);font-size:14px;padding-top:16px}} .crumbs a{{color:#7dd3fc;text-decoration:none;font-weight:600}}
a.btn.primary{{background:linear-gradient(135deg,#2563eb,#38bdf8);border-color:#38bdf8;color:#fff;display:inline-block;margin-top:20px;font-size:20px;padding:16px 34px;box-shadow:0 6px 20px rgba(56,189,248,.35)}}
h1{{text-shadow:0 4px 26px rgba(56,189,248,.35)}}
footer{{color:rgba(255,255,255,.6);font-size:12.5px;padding:40px 0 24px;letter-spacing:.04em}}
.whobar{{display:flex;gap:12px;justify-content:center;align-items:center;flex-wrap:wrap;
  color:rgba(255,255,255,.62);font-size:12.5px;padding:12px 16px 0}}
.whobar a{{color:#7dd3fc;text-decoration:none;font-weight:700}}
</style></head><body>
<div class="whobar">{who}</div>
<div class="crumbs">{crumbs}</div>
{body}
<footer>hardywu.com — Try New Things 🛠️</footer>
<script src="/track.js" defer></script></body></html>"""

def portfolio_home():
    cards = "".join(
        f'<a class="card" href="/{k}"><img src="/sec/{k}.jpg" style="width:140px;height:140px;object-fit:cover;border-radius:18px;margin:0 auto 2px" alt="{v["title"]}"><h2>{v["title"]}</h2><p>{v["blurb"]}</p></a>'
        for k, v in PORTFOLIO.items())
    return p_page("Hardy Wu", f"""
<header><img src="/logo.png" alt="Hardy Wu logo" style="width:104px;height:104px;border-radius:22px;margin-top:6px">
<p style="letter-spacing:.35em;font-weight:700;color:#fff;opacity:.72;font-size:14px;margin:14px 0 0;font-weight:800">HARDY WU</p>
<h1 style="font-size:clamp(46px,9.5vw,94px);font-weight:900;font-style:italic;letter-spacing:-0.045em;margin:8px 0 12px;line-height:.95;color:#fff">TRY NEW<br>THINGS.</h1>
<p class="tag">Apps, video games, 3D prints & robots.</p></header>
<div class="cards">{cards}</div>""")

SHOP_HOST = "https://shop.hardywu.com"

def portfolio_section(section):
    if section == "3d":
        return redirect(SHOP_HOST)  # the 3D section IS the live-preview store
    sec = PORTFOLIO.get(section)
    if not sec:
        return p_page("Not found", "<h1>Section not found</h1>", '<a href="/">← hardywu.com</a>'), 404
    def _thumb(slug, it):
        src = it.get("img") or (it.get("photo") if it.get("shop") else None)
        return (f'<img src="{src}" style="width:120px;height:120px;object-fit:cover;border-radius:16px;margin:0 auto 2px" alt="{it["name"]}">'
                if src else f'<div class="big">{it["emoji"]}</div>')
    cards = "".join(
        f'<a class="card" href="/{section}/{slug}">{_thumb(slug, it)}<h2>{it["name"]}</h2><p>{it["desc"]}</p></a>'
        for slug, it in sec["items"].items()) or '<p class="tag">Coming soon.</p>'
    return p_page(f'{sec["title"]} — Hardy Wu', f"""
<header><img src="/sec/{section}.jpg" style="width:96px;height:96px;object-fit:cover;border-radius:18px"><h1>{sec["title"]}</h1><p class="tag">{sec["blurb"]}</p></header>
<div class="cards">{cards}</div>""", f'<a href="/">← hardywu.com</a>')

def portfolio_item(section, slug):
    if section == "3d":
        import difflib
        target = slug if slug in SHOP_PRODUCTS else next(iter(difflib.get_close_matches(slug.lower(), list(SHOP_PRODUCTS.keys()), n=1, cutoff=0.5)), None)
        return redirect(f"{SHOP_HOST}/products/{target}") if target else redirect(SHOP_HOST)
    sec = PORTFOLIO.get(section)
    it = (sec or {}).get("items", {}).get(slug)
    if not it and sec:
        # Forgive typos: "bookeeep" → /apps/bookkeep.
        import difflib
        close = difflib.get_close_matches(slug.lower(), list(sec["items"].keys()), n=1, cutoff=0.6)
        if close:
            return redirect(f"/{section}/{close[0]}")
    if not it:
        return p_page("Not found", "<h1>Not found</h1>", f'<a href="/{section}">← back</a>'), 404
    if it.get("redirect"):
        return redirect(login_url_for(_key(slug)))
    crumbs = f'<a href="/">hardywu.com</a> / <a href="/{section}">{sec["title"]}</a> / {it["name"]}'
    if it.get("shop"):
        photo = f'<img src="{it["photo"]}" style="max-width:320px;width:90%;border-radius:14px;margin:10px auto;display:block">' if it.get("photo") else f'<div style="font-size:64px">{it["emoji"]}</div>'
        colors = "".join(f'<option>{c}</option>' for c in SHOP_COLORS)
        return p_page(f'{it["name"]} — Hardy Wu', f"""
<header>{photo}<h1>{it["name"]}</h1>
<p class="tag" style="max-width:520px;margin:8px auto">{it["desc"]}</p>
<div id="orderBox" style="max-width:380px;margin:16px auto;background:#1c2333;border:1px solid #3a4560;border-radius:16px;padding:20px;text-align:left">
  <b style="display:block;text-align:center;margin-bottom:10px">Order — ${it["price"]:.2f} each</b>
  <label style="font-size:13px;color:#9aa4bd">Your name<br><input id="oBuyer" style="width:95%;font-size:16px;padding:8px;border-radius:8px;border:1px solid #3a4560;background:#111827;color:#fff"></label><br><br>
  <label style="font-size:13px;color:#9aa4bd">Color<br><select id="oColor" style="width:99%;font-size:16px;padding:8px;border-radius:8px;border:1px solid #3a4560;background:#111827;color:#fff">{colors}</select></label><br><br>
  <label style="font-size:13px;color:#9aa4bd">Custom text (optional)<br><input id="oCustom" maxlength="80" style="width:95%;font-size:16px;padding:8px;border-radius:8px;border:1px solid #3a4560;background:#111827;color:#fff"></label><br><br>
  <label style="font-size:13px;color:#9aa4bd">Quantity<br><input id="oQty" type="number" value="1" min="1" max="99" style="width:80px;font-size:16px;padding:8px;border-radius:8px;border:1px solid #3a4560;background:#111827;color:#fff"></label><br><br>
  <button onclick="placeOrder()" style="width:100%;font-size:18px;font-weight:700;padding:12px;border-radius:10px;border:0;background:#2563eb;color:#fff;cursor:pointer">🛒 Place order</button>
  <div id="oErr" style="color:#ff9d9d;min-height:20px;font-size:13px;margin-top:8px"></div>
  <div style="text-align:center;margin-top:6px"><a href="https://shop.hardywu.com/products/{slug}" style="color:#7ea3f7;font-size:13px">🎨 or customize with live preview</a></div>
</div>
<script>
async function placeOrder(){{
  const body={{product:"{slug}",buyer:document.getElementById("oBuyer").value,
    color:document.getElementById("oColor").value,custom:document.getElementById("oCustom").value,
    qty:Number(document.getElementById("oQty").value)}};
  const r=await fetch("/api/order",{{method:"POST",headers:{{"Content-Type":"application/json"}},body:JSON.stringify(body)}});
  const j=await r.json();
  if(r.ok){{document.getElementById("orderBox").innerHTML=
    "<div style=\'text-align:center\'><div style=\'font-size:44px\'>✅</div><b>Order received!</b><p style=\'color:#9aa4bd\'>"+body.qty+" × "+j.name+" — total $"+j.total.toFixed(2)+"<br>Order "+j.order+". Hardy will confirm and arrange delivery and payment.</p></div>";}}
  else{{document.getElementById("oErr").textContent=j.error||"Something went wrong.";}}
}}
</script></header>""", crumbs)
    btn = f'<a class="btn primary" href="{login_url_for(_key(slug))}">{it.get("link_label","Open")}</a>' if it.get("link") else ""
    hero = (f'<img src="{it["img"]}" style="width:200px;height:200px;object-fit:cover;border-radius:24px">'
            if it.get("img") else f'<div style="font-size:64px">{it["emoji"]}</div>')
    return p_page(f'{it["name"]} — Hardy Wu', f"""
<header>{hero}<h1>{it["name"]}</h1>
<p class="tag" style="max-width:480px;margin:8px auto">{it["desc"]}</p>{btn}</header>""", crumbs)

for _s in PORTFOLIO:
    app.add_url_rule(f"/{_s}", f"portfolio_sec_{_s}", (lambda s=_s: portfolio_section(s)))
    app.add_url_rule(f"/{_s}/<slug>", f"portfolio_item_{_s}", (lambda slug, s=_s: portfolio_item(s, slug)))


PUBLIC_PATHS = {"/login", "/api/login", "/api/health", "/logout", "/logo.png", "/favicon.png",
                "/api/admin/import-data"}   # checks its own secret

def is_local_request():
    on_local_name = (request.host or "").split(":")[0] in ("127.0.0.1", "localhost")
    from_this_machine = request.remote_addr in ("127.0.0.1", "::1", None)
    return on_local_name and from_this_machine

@app.before_request
def require_passcode():
    if request.method == "OPTIONS" or (is_local_request() and not is_portfolio_host()):
        return None
    if is_portfolio_host():
        p = request.path
        key = login_slug_from_host()
        if key is not None:                              # login<thing>.hardywu.com
            if p in ("/api/visitor", "/api/login", "/logo.png", "/favicon.png", "/track.js", "/signout"):
                return None
            if p != "/":
                return redirect("/")
            tgt = login_targets().get(key)
            if not tgt:
                return redirect(SITE_ORIGIN + "/")
            if key == "bookkeep":                        # BookKeep has real accounts: its own login
                return redirect(APP_HOST) if session.get("authed") else LOGIN_HTML
            if visitor():                                # already signed in → straight through
                track("open", tgt["name"], dest(tgt))
                return redirect(dest(tgt))
            return VISITOR_HTML
        open_paths = (p in ("/logo.png", "/favicon.png", "/track.js", "/api/visitor",
                            "/api/track", "/signout", "/api/order")
                      or p.startswith("/products/") or p.startswith("/sec/")
                      or p.startswith("/item/"))
        ok = (p == "/" or p == "/activity" or p.startswith("/play/") or p.startswith("/go/")
              or open_paths
              or any(p == f"/{sec}" or p.startswith(f"/{sec}/") for sec in PORTFOLIO))
        if not ok:
            return redirect(APP_HOST + p)  # app bookmarks saved on hardywu.com
        if open_paths:
            return None
        # browsing is open to everyone; playing a game (or Hardy's report) asks who you are
        needs_login = p.startswith("/play/") or p == "/activity"
        if needs_login and not visitor():
            return redirect(login_url_for(play_key(p))) if on_real_site() else VISITOR_HTML
        if visitor():
            track("view", friendly_label(p), p)  # note that they opened this page
        return None
    if request.path in PUBLIC_PATHS or session.get("authed"):
        return None
    if request.path.startswith("/api/"):
        return jsonify(error="Please log in."), 401
    return redirect("/login")

@app.get("/go/<key>")
def go_to(key):
    """Local stand-in for login<thing>.hardywu.com (there are no subdomains on 127.0.0.1)."""
    key = "" if key == "home" else _key(key)
    tgt = login_targets().get(key)
    if not tgt:
        return redirect("/")
    if on_real_site():
        return redirect(login_url_for(key))
    if key == "bookkeep":
        return redirect("http://127.0.0.1:5000/")
    if not visitor():
        return VISITOR_HTML
    track("open", tgt["name"], dest(tgt))
    return redirect(dest(tgt))

LOGIN_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>BookKeep — Who's there?</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:-apple-system,sans-serif;background:#111827;color:#f4f6fb;text-align:center;padding:60px 20px}
.card{max-width:380px;margin:0 auto;background:#1c2333;border-radius:16px;padding:30px}
input{font-size:20px;padding:12px;border-radius:10px;border:1px solid #3a4560;background:#111827;color:#fff;width:90%;text-align:center;margin:14px 0}
button{font-size:19px;font-weight:700;padding:12px 34px;border-radius:10px;border:0;background:#2563eb;color:#fff;cursor:pointer}
.err{color:#ff9d9d;min-height:22px}
p.small{color:#9aa4bd;font-size:13px}</style></head><body>
<div class="card"><h1>📒 BookKeep</h1><p>Log in to BookKeep</p>
<input id="nm" autofocus placeholder="Your name (e.g. Hardy)" autocomplete="name" maxlength="40">
<input id="em" type="email" placeholder="Your email" autocomplete="email" maxlength="80">
<div class="err" id="err"></div><button onclick="go()">Open my books</button>
<p class="small">Your name opens your own books on this device. You stay logged in for 90 days — closing the tab does not log you out.</p></div>
<script>
async function go(){
  const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name:document.getElementById("nm").value,email:document.getElementById("em").value})});
  const j=await r.json();
  if(r.ok){location.href=j.next||"/";}
  else{document.getElementById("err").textContent=j.error||"Please fill in both fields.";}
}
for(const id of ["nm","em"]) document.getElementById(id).addEventListener("keydown",e=>{if(e.key==="Enter")go();});
</script></body></html>"""

@app.get("/login")
def login_page():
    # live, BookKeep's login lives at loginbookkeep.hardywu.com
    return redirect("https://loginbookkeep.hardywu.com/") if on_real_site() else LOGIN_HTML

# The creator (owner) sees the member list, grants discounts, and gets every
# feature free. Creator = the owner email (BOOKKEEP_OWNER_EMAIL in .env), the
# owner name, or any local request (the Mac is headquarters).
CREATOR = os.environ.get("BOOKKEEP_OWNER", "Hardy Wu").strip()
OWNER_EMAIL = ensure_env_secret("BOOKKEEP_OWNER_EMAIL", lambda: "barbaratao@gmail.com").strip().lower()

def is_owner():
    if is_local_request():
        return True
    if (session.get("email") or "").strip().lower() == OWNER_EMAIL and OWNER_EMAIL:
        return True
    return session.get("name", "").strip().casefold() == CREATOR.casefold()

def member_row(name):
    con = db()
    row = con.execute("SELECT * FROM members WHERE name=? COLLATE NOCASE", (name,)).fetchone()
    con.close()
    return dict(row) if row else None

@app.post("/api/login")
def do_login():
    x = request.get_json(force=True)
    name = str(x.get("name") or "").strip()[:40]
    email = str(x.get("email") or "").strip().lower()[:80]
    if len(name) < 1:
        return jsonify(error="Please type your name."), 400
    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify(error="Please type a real email address."), 400
    session.permanent = True
    session["authed"] = True
    session["name"] = name
    session["email"] = email
    con = db()
    con.execute("""INSERT INTO members(name,email,first_seen,last_seen,visits) VALUES(?,?,?,?,1)
                   ON CONFLICT(name) DO UPDATE SET last_seen=excluded.last_seen,
                     email=excluded.email, visits=visits+1""",
                (name, email, now_iso(), now_iso()))
    con.commit(); con.close()
    return jsonify(ok=True, name=name, email=email,
                   next=APP_HOST if login_slug_from_host() == "bookkeep" else "/")

@app.get("/api/whoami")
def whoami():
    name = session.get("name")
    m = member_row(name) if name else None
    return jsonify(name=name, email=session.get("email"), owner=is_owner(),
                   discount=float(m["discount_pct"]) if m else 0)

@app.get("/api/members")
def list_members():
    if not is_owner():
        return jsonify(error="Only the creator can see the member list."), 403
    con = db()
    rows = [dict(r) for r in con.execute("SELECT * FROM members ORDER BY last_seen DESC")]
    con.close()
    return jsonify(members=rows)

@app.post("/api/members/delete")
def delete_member():
    if not is_owner():
        return jsonify(error="Only the creator can remove members."), 403
    x = request.get_json(force=True)
    name = str(x.get("name") or "").strip()[:40]
    if not name:
        return jsonify(error="No member name given."), 400
    con = db()
    cur = con.execute("DELETE FROM members WHERE name=? COLLATE NOCASE", (name,))
    con.commit(); con.close()
    if not cur.rowcount:
        return jsonify(error="No such member."), 404
    # Note: only the membership row (and its discount) is removed. Their books
    # live on their own device and their backups stay safe on the server.
    return jsonify(ok=True, removed=name)

@app.post("/api/members/discount")
def set_discount():
    if not is_owner():
        return jsonify(error="Only the creator can give discounts."), 403
    x = request.get_json(force=True)
    name = str(x.get("name") or "").strip()[:40]
    pct = max(0.0, min(100.0, float(x.get("discount_pct") or 0)))
    if not name:
        return jsonify(error="No member name given."), 400
    con = db()
    con.execute("""INSERT INTO members(name,first_seen,last_seen,visits,discount_pct) VALUES(?,?,?,0,?)
                   ON CONFLICT(name) DO UPDATE SET discount_pct=excluded.discount_pct""",
                (name, now_iso(), now_iso(), pct))
    con.commit(); con.close()
    return jsonify(ok=True, name=name, discount_pct=pct)

@app.get("/logout")
def logout():
    session.clear()
    return redirect("/login")

def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    con=db()
    con.executescript("""
    CREATE TABLE IF NOT EXISTS transcripts(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT,
      date_time TEXT NOT NULL,
      date TEXT,
      speaker TEXT,
      source TEXT,
      text TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS receipts(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      transcript_id TEXT NOT NULL,
      person TEXT,
      date_time TEXT NOT NULL,
      signature_file TEXT,
      signature_sha256 TEXT,
      image_file TEXT,
      image_sha256 TEXT,
      record_sha256 TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS journal(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      transcript_id TEXT,
      date TEXT,
      description TEXT,
      lines_json TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members(
      name TEXT PRIMARY KEY,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      visits INTEGER NOT NULL DEFAULT 0,
      discount_pct REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS orders(
      id TEXT PRIMARY KEY,
      product TEXT NOT NULL,
      product_name TEXT,
      qty INTEGER NOT NULL,
      price_each REAL NOT NULL,
      total REAL NOT NULL,
      color TEXT,
      custom_text TEXT,
      buyer TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_log(
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT UNIQUE NOT NULL,
      user_id TEXT,
      event_type TEXT NOT NULL,
      object_id TEXT,
      object_hash TEXT NOT NULL,
      previous_hash TEXT,
      chain_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    """)
    try:
        con.execute("ALTER TABLE members ADD COLUMN email TEXT")
    except sqlite3.OperationalError:
        pass  # column already exists
    con.commit(); con.close()

def canonical(obj):
    return json.dumps(obj,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()

def sha(obj):
    return hashlib.sha256(canonical(obj)).hexdigest()

def append_audit(con,user_id,event_type,object_id,object_hash):
    row=con.execute("SELECT chain_hash FROM audit_log ORDER BY seq DESC LIMIT 1").fetchone()
    prev=row["chain_hash"] if row else ""
    payload=f"{prev}|{user_id}|{event_type}|{object_id}|{object_hash}|{now_iso()}".encode()
    chain=hashlib.sha256(payload).hexdigest()
    con.execute("""INSERT INTO audit_log(event_id,user_id,event_type,object_id,object_hash,previous_hash,chain_hash,created_at)
                   VALUES(?,?,?,?,?,?,?,?)""",
                (str(uuid.uuid4()),user_id,event_type,object_id,object_hash,prev,chain,now_iso()))

def save_data_url(value,prefix):
    if not value or not value.startswith("data:"):
        return None,None
    header,b64=value.split(",",1)
    ext="png"
    if "jpeg" in header or "jpg" in header: ext="jpg"
    raw=base64.b64decode(b64)
    digest=hashlib.sha256(raw).hexdigest()
    name=f"{prefix}_{digest[:16]}.{ext}"
    (FILES/name).write_bytes(raw)
    return name,digest

@app.after_request
def cors(resp):
    resp.headers["Access-Control-Allow-Origin"]="*"
    resp.headers["Access-Control-Allow-Headers"]="Content-Type"
    resp.headers["Access-Control-Allow-Methods"]="GET,POST,OPTIONS"
    return resp

@app.route("/api/<path:p>",methods=["OPTIONS"])
def options(p): return ("",204)

# Serve the app itself so one URL (or one tunnel) covers frontend + API.
FRONTEND_FILES = {"index.html", "app.js", "style.css"}

def _nocache(resp):
    # Edits on the Mac must show up instantly through the domain: make every
    # cache (Cloudflare included) re-check with us before serving app files.
    resp.headers["Cache-Control"] = "no-cache"
    return resp

@app.get("/")
def index_page():
    if is_portfolio_host():
        return portfolio_home()
    return _nocache(send_from_directory(BASE, "index.html"))

@app.get("/<path:fname>")
def frontend(fname):
    if fname in FRONTEND_FILES:
        return _nocache(send_from_directory(BASE, fname))
    return jsonify(error="Not found."), 404

@app.get("/sec/<name>")
def section_image(name):
    if name in {"apps.jpg", "games.jpg", "3d.jpg", "robotics.jpg"}:
        return send_from_directory(BASE, "sec_" + name)
    return jsonify(error="Not found."), 404

@app.get("/item/<name>")
def item_image(name):
    if name in {"bookkeep.jpg", "footballsim.jpg", "nova.jpg", "quest.jpg",
                "novastrike.jpg", "pokemonadv.jpg"}:
        return send_from_directory(BASE, "item_" + name)
    return jsonify(error="Not found."), 404

FIFA_DIR = BASE.parent / "fifa" / "game"

@app.get("/play/fifa")
def play_fifa_noslash():
    # Without the trailing slash the game's relative script paths resolve one
    # folder too high (three.min.js/game.js/assets.js 404).
    return redirect("/play/fifa/")

@app.get("/play/fifa/")
def play_fifa():
    # no-cache: every visit re-checks with the Mac, so game updates go live
    # immediately instead of sitting behind a 4-hour CDN cache.
    return _nocache(send_from_directory(FIFA_DIR, "index.html", max_age=0))

GAMES_DIR = BASE / "games"

@app.get("/play/nova")
def play_nova():
    return _nocache(send_from_directory(GAMES_DIR, "nova.html", max_age=0))

@app.get("/play/quest")
def play_quest():
    return _nocache(send_from_directory(GAMES_DIR, "quest.html", max_age=0))

@app.get("/play/fifa/<path:fname>")
def play_fifa_files(fname):
    return _nocache(send_from_directory(FIFA_DIR, fname, max_age=0))

@app.get("/logo.png")
def company_logo():
    return send_from_directory(BASE, "logo.png")

@app.get("/favicon.png")
def company_favicon():
    return send_from_directory(BASE, "favicon.png")

@app.get("/api/health")
def health():
    return jsonify(status="ok",database=str(DB.name),time=now_iso())

@app.post("/api/transcripts")
def transcript():
    x=request.get_json(force=True)
    # Normalize BEFORE hashing so the hash always matches what the row stores
    # (verify() recomputes hashes from row contents).
    date_time=x.get("dateTime") or now_iso()
    text=x.get("text","")
    obj={"id":x["id"],"userId":x["userId"],"userName":x.get("userName"),
         "dateTime":date_time,"date":x.get("date"),"speaker":x.get("speaker"),
         "source":x.get("source"),"text":text}
    digest=sha(obj)
    con=db()
    cur=con.execute("""INSERT OR IGNORE INTO transcripts(id,user_id,user_name,date_time,date,speaker,source,text,sha256,created_at)
                   VALUES(?,?,?,?,?,?,?,?,?,?)""",
                (x["id"],x["userId"],x.get("userName"),date_time,x.get("date"),
                 x.get("speaker"),x.get("source"),text,digest,now_iso()))
    if cur.rowcount:  # retries/syncs of an already-stored record don't spam the audit log
        append_audit(con,x["userId"],"transcript",x["id"],digest)
    con.commit();con.close()
    return jsonify(ok=True,sha256=digest)

@app.post("/api/journal")
def journal():
    x=request.get_json(force=True)
    lines=x.get("lines") or []
    obj={"id":x["id"],"userId":x["userId"],"transcriptId":x.get("transcriptId"),
         "date":x.get("date"),"description":x.get("description"),"lines":lines}
    digest=sha(obj)
    con=db()
    cur=con.execute("""INSERT OR IGNORE INTO journal(id,user_id,transcript_id,date,description,lines_json,sha256,created_at)
                   VALUES(?,?,?,?,?,?,?,?)""",
                (x["id"],x["userId"],x.get("transcriptId"),x.get("date"),x.get("description"),
                 json.dumps(lines),digest,now_iso()))
    if cur.rowcount:
        append_audit(con,x["userId"],"journal",x["id"],digest)
    con.commit();con.close()
    return jsonify(ok=True,sha256=digest)

@app.post("/api/receipts")
def receipt():
    x=request.get_json(force=True)
    sig_file,sig_hash=save_data_url(x.get("signatureData"),"sig")
    img_file,img_hash=save_data_url(x.get("imageData"),"img")
    date_time=x.get("dateTime") or now_iso()
    obj={"id":x["id"],"userId":x["userId"],"transcriptId":x["transcriptId"],
         "person":x.get("person"),"dateTime":date_time}
    obj.update(signature_sha256=sig_hash,image_sha256=img_hash)
    digest=sha(obj)
    con=db()
    cur=con.execute("""INSERT OR IGNORE INTO receipts(id,user_id,transcript_id,person,date_time,signature_file,signature_sha256,image_file,image_sha256,record_sha256,created_at)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
                (x["id"],x["userId"],x["transcriptId"],x.get("person"),date_time,
                 sig_file,sig_hash,img_file,img_hash,digest,now_iso()))
    if cur.rowcount:
        append_audit(con,x["userId"],"receipt",x["id"],digest)
    con.commit();con.close()
    return jsonify(ok=True,sha256=digest,signature_sha256=sig_hash,image_sha256=img_hash)

@app.get("/api/user/<user_id>/evidence")
def evidence(user_id):
    con=db()
    ts=[dict(r) for r in con.execute("SELECT * FROM transcripts WHERE user_id=? ORDER BY date_time DESC",(user_id,))]
    rs=[dict(r) for r in con.execute("SELECT * FROM receipts WHERE user_id=? ORDER BY date_time DESC",(user_id,))]
    js=[dict(r) for r in con.execute("SELECT * FROM journal WHERE user_id=? ORDER BY date DESC",(user_id,))]
    con.close()
    return jsonify(transcripts=ts,receipts=rs,journal=js)

# ===================== AI BOOKKEEPING AGENT (Phase 1: text) =====================
# The LLM interprets language; deterministic validation below decides whether a
# proposal is safe to show. Nothing posts without user approval in the app.

TRANSACTION_TYPES = ["income", "expense", "transfer", "invoice", "bill",
                     "receive_invoice", "pay_bill", "use_supplies",
                     "buy_investment", "sell_investment"]

AGENT_SYSTEM_PROMPT = """You are the BookKeep accounting agent. Turn one user message \
into double-entry bookkeeping actions.

Rules:
- Split the message into as many distinct actions as needed. Never merge separate \
sales/expenses unless the user explicitly asks for one combined entry.
- category must be a conventional account from this chart when it fits: Sales Revenue, \
Service Revenue, Interest Income, Other Income, Supplies Expense, Rent Expense, \
Utilities Expense, Wages Expense, Other Expense, Cost of Goods Sold, R&D Expense. Never use raw item words (e.g. a \
ruler sale is category "Sales Revenue", not "ruler"). Put item/customer details in \
note; for bills and invoices ALWAYS name who is owed / who owes in note (e.g. \
"3D printer, owed to Mommy").
- note style: a SHORT plain-English summary of the important details only — who, \
what, how much — like "I owe Mommy $1,000 for the 3D printer". Never paste the \
raw conversation into the note; drop filler words (yes, okay, um) and clarifying \
back-and-forth. The exact words are archived separately as evidence.
- accountName is the real money account (Cash, Checking, Savings...). Use one of the \
user's existing accounts from context when possible. If the user says "cash" and no \
Cash account exists, emit a create_account action for Cash (type "Cash") BEFORE the \
transaction that uses it.
- entry.type semantics: income = money received now; expense = paid now; invoice = \
customer will pay later (A/R); bill = vendor bill not yet paid (A/P); receive_invoice \
= customer pays an invoice; pay_bill = paying a vendor bill; transfer = between own \
accounts (set toAccountName); use_supplies = adjusting entry for materials already \
owned and now consumed — no money moves, the app posts Supplies -> the category. \
For use_supplies set accountName to "Supplies" and category to exactly one of: \
"Cost of Goods Sold" (materials that went INTO products sold), "R&D Expense" \
(materials spent on tests, failed prints, experiments, waste), or "Supplies \
Expense" (general use). Consuming owned materials is use_supplies.
- This business uses standard costing: BUYING raw materials to use later \
(filament, resin, spools, stock) gets category "Supplies" — the ASSET — never \
"Supplies Expense", whether paid now (expense entry) or owed (bill entry, e.g. \
filament bought on credit from Mommy). The expense comes later via use_supplies \
when materials are consumed. Only trivial items used up immediately go straight \
to Supplies Expense.
- Investments: buy_investment = buying shares/stock (amount = TOTAL paid; set \
ticker to the symbol e.g. "AAPL" and shares to the count; the app posts Dr \
Investments / Cr the money account). sell_investment = selling shares (amount = \
TOTAL proceeds; ticker + shares required; the app computes the gain or loss \
against average cost automatically — never compute it yourself). "at $X each" \
means amount = X * shares. Dividends received are plain income with category \
"Investment Income". For all non-investment types set ticker=null, shares=null.
- Standard costing: when a sale message ALSO states its material cost ("sold a \
ruler for $10, it used about 50 cents of filament"), add BOTH actions: the income \
AND a use_supplies action for the stated material cost with category "Cost of \
Goods Sold". Never estimate the material cost yourself — only record it when the \
user states it.
- Dates: resolve phrases like "yesterday" or "last Monday" against context.today; \
output YYYY-MM-DD. No date phrase means context.today. Two-digit years ("8/14/26") \
are 20XX — 2026, never 1926 or 2016. If a date would land more than a year in the \
past, it is almost certainly a typo: ask instead of recording it. A bare day like "on the \
14th" or "it is on the 14" means that day of the CURRENT month from context.today. \
Look for date phrases across ALL turns of the conversation — if the user adds or \
corrects the date after your proposal ("it was on the 14"), re-issue the FULL \
corrected action list with the right date, not a new entry.
- Money: parse $1,000 / 1k / "one thousand dollars" exactly. $1,000 must NEVER \
become 1. Keep separate amounts separate.
- context.openInvoices and context.openBills list invoices/bills already \
recorded and not yet settled. When the user reports paying (or being paid for) \
something that matches one of these by amount or description, use pay_bill / \
receive_invoice so the expense or income is not counted twice. If they mention \
paying a bill that has no matching open item, record a plain expense.
- Buyer vs seller: this is the user's own books. When someone ELSE is the buyer \
("Daddy bought a ruler for $3", "Mommy bought a crab gauge") they are a customer \
buying FROM the user - record income (Sales Revenue), with the customer's name in \
note. Only the user's own purchases ("I bought...", "paid for...", "we spent...") \
are expenses.
- total = the sum of income-type entry amounts you propose (0 if none). Compute it \
from your own entries.
- The conversation can span multiple turns: earlier user/assistant messages may \
precede the latest one. Read them — the latest message is often the ANSWER to your \
previous clarifying question ("I owe $1,000 for it" refers to the item discussed \
before). Combine the turns; do not restart the questioning. Voice input may be \
garbled ("Ode to Mommy" = "owed to Mommy") — interpret charitably from context.
- Acquiring equipment or another lasting asset while owing for it (no money moved \
yet) is a bill with category "Equipment" (the app posts Dr Equipment / Cr Accounts \
Payable); paying that debt later is pay_bill. A true loan of an item with nothing \
owed is NOT a transaction: set needs_clarification=true and briefly explain in \
question that there is nothing to record.
- Never invent an amount, account, customer, or date. If material information is \
ambiguous or missing, set needs_clarification=true and ask ONE short question, with \
actions=[].
- For create_account actions set entry=null. For transaction actions set name=null \
and type=null at the action level (the transaction type goes inside entry.type)."""

ENTRY_SCHEMA = {
    "type": "object",
    "properties": {
        "date": {"type": "string", "description": "YYYY-MM-DD"},
        "type": {"type": "string", "enum": TRANSACTION_TYPES},
        "accountName": {"type": "string"},
        "toAccountName": {"type": ["string", "null"]},
        "category": {"type": "string"},
        "amount": {"type": "number"},
        "note": {"type": "string"},
        "ticker": {"type": ["string", "null"]},
        "shares": {"type": ["number", "null"]},
    },
    "required": ["date", "type", "accountName", "toAccountName", "category",
                 "amount", "note", "ticker", "shares"],
    "additionalProperties": False,
}

AGENT_SCHEMA = {
    "type": "object",
    "properties": {
        "needs_clarification": {"type": "boolean"},
        "question": {"type": "string"},
        "summary": {"type": "string"},
        "total": {"type": "number"},
        "actions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": ["create_account", "transaction"]},
                    "name": {"type": ["string", "null"]},
                    "type": {"type": ["string", "null"]},
                    "entry": {"anyOf": [ENTRY_SCHEMA, {"type": "null"}]},
                },
                "required": ["kind", "name", "type", "entry"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["needs_clarification", "question", "summary", "total", "actions"],
    "additionalProperties": False,
}

def validate_agent_plan(plan):
    """Deterministic safety net over the LLM output. Returns an error string or None."""
    if plan.get("needs_clarification"):
        return None
    actions = plan.get("actions") or []
    if not actions:
        return "no bookkeeping actions were produced"
    income_total = 0.0
    for a in actions:
        kind = a.get("kind")
        if kind == "create_account":
            if not (a.get("name") or "").strip():
                return "an account-creation action is missing its name"
        elif kind == "transaction":
            e = a.get("entry") or {}
            amt = e.get("amount")
            if not isinstance(amt, (int, float)) or amt != amt or amt <= 0:
                return f"a transaction has an invalid amount ({amt!r})"
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", e.get("date") or ""):
                return f"a transaction has an invalid date ({e.get('date')!r})"
            if e["date"] < f"{datetime.date.today().year - 1}-01-01":
                return f"a transaction is dated suspiciously far in the past ({e['date']})"
            if e.get("type") not in TRANSACTION_TYPES:
                return f"a transaction has an invalid type ({e.get('type')!r})"
            if not (e.get("accountName") or "").strip():
                return "a transaction is missing its account"
            if e["type"] == "transfer" and not (e.get("toAccountName") or "").strip():
                return "a transfer is missing its destination account"
            if e["type"] in ("buy_investment", "sell_investment"):
                if not (e.get("ticker") or "").strip():
                    return "an investment entry is missing its stock symbol"
                sh = e.get("shares")
                if not isinstance(sh, (int, float)) or sh != sh or sh <= 0:
                    return f"an investment entry has an invalid share count ({sh!r})"
            if e["type"] == "income":
                income_total += float(amt)
        else:
            return f"unknown action kind {kind!r}"
    # The server, not the model, is authoritative for the declared total.
    plan["total"] = round(income_total, 2)
    return None

@app.post("/api/agent")
def agent():
    x = request.get_json(force=True)
    message = (x.get("message") or "").strip()
    if not message:
        return jsonify(error="No message provided."), 400
    if not os.environ.get("OPENAI_API_KEY", "").strip():
        return jsonify(error="OPENAI_API_KEY is not set on the server. "
                             "Add it to .env and restart the backend."), 500

    model = (x.get("model") or "").strip() or os.environ.get("OPENAI_MODEL", "gpt-5.1").strip()
    context = x.get("context") or {}
    slim_context = {k: context.get(k) for k in
                    ("today", "accountingMethod", "accounts", "openInvoices", "openBills")}

    # Recent chat turns so answers to clarifying questions keep their context.
    history = []
    for h in (x.get("history") or [])[-8:]:
        if isinstance(h, dict) and h.get("role") in ("user", "assistant") and isinstance(h.get("content"), str):
            history.append({"role": h["role"], "content": h["content"][:600]})

    try:
        from openai import OpenAI
        client = OpenAI()
        resp = client.chat.completions.create(
            model=model,
            max_completion_tokens=8000,
            messages=[
                {"role": "system", "content": AGENT_SYSTEM_PROMPT},
                *history,
                {"role": "user", "content":
                    "Context:\n" + json.dumps(slim_context, ensure_ascii=False)
                    + "\n\nUser message:\n" + message},
            ],
            response_format={"type": "json_schema", "json_schema": {
                "name": "bookkeeping_plan", "strict": True, "schema": AGENT_SCHEMA}},
        )
        plan = json.loads(resp.choices[0].message.content)
    except Exception as err:
        return jsonify(error=f"AI provider error: {err}"), 502

    problem = validate_agent_plan(plan)
    if problem:
        # Fail safe: never hand the app an entry that flunked validation.
        return jsonify(needs_clarification=True,
                       question=f"I could not prepare a safe entry ({problem}). "
                                "Please restate it with the amount, date, and account.",
                       summary="", total=0, actions=[])
    return jsonify(plan)

def rebuild_transcript_obj(r):
    return {"id":r["id"],"userId":r["user_id"],"userName":r["user_name"],
            "dateTime":r["date_time"],"date":r["date"],"speaker":r["speaker"],
            "source":r["source"],"text":r["text"]}

def rebuild_journal_obj(r):
    return {"id":r["id"],"userId":r["user_id"],"transcriptId":r["transcript_id"],
            "date":r["date"],"description":r["description"],
            "lines":json.loads(r["lines_json"])}

def rebuild_receipt_obj(r):
    return {"id":r["id"],"userId":r["user_id"],"transcriptId":r["transcript_id"],
            "person":r["person"],"dateTime":r["date_time"],
            "signature_sha256":r["signature_sha256"],"image_sha256":r["image_sha256"]}

@app.get("/api/audit/verify")
def verify():
    con=db()
    rows=con.execute("SELECT * FROM audit_log ORDER BY seq").fetchall()

    # 1) Chain continuity: every event must link to the previous one.
    prev=""
    chain_ok=True
    broken_at=None
    for r in rows:
        if (r["previous_hash"] or "") != prev:
            chain_ok=False; broken_at=r["seq"]; break
        prev=r["chain_hash"]

    # 2) Content integrity: recompute each stored record's hash from its current
    #    row contents and compare against BOTH the row's stored hash and the hash
    #    recorded in the audit log at save time. Any edit to a row is flagged.
    tables={
        "transcript":("transcripts","sha256",rebuild_transcript_obj),
        "journal":("journal","sha256",rebuild_journal_obj),
        "receipt":("receipts","record_sha256",rebuild_receipt_obj),
    }
    problems=[]
    checked=0
    audited={}  # (event_type, object_id) -> object_hash from the audit log
    for r in rows:
        audited[(r["event_type"],r["object_id"])]=r["object_hash"]
    for event_type,(table,hash_col,rebuild) in tables.items():
        for row in con.execute(f"SELECT * FROM {table}"):
            checked+=1
            try:
                actual=sha(rebuild(row))
            except Exception:
                problems.append({"table":table,"id":row["id"],"problem":"row could not be re-hashed"})
                continue
            if actual!=row[hash_col]:
                problems.append({"table":table,"id":row["id"],"problem":"row contents do not match stored hash"})
            logged=audited.get((event_type,row["id"]))
            if logged is not None and actual!=logged:
                problems.append({"table":table,"id":row["id"],"problem":"row contents do not match audit-log hash"})
    con.close()
    ok=chain_ok and not problems
    return jsonify(ok=ok,events=len(rows),chain_ok=chain_ok,broken_at=broken_at,
                   records_checked=checked,problems=problems,last_chain_hash=prev)

@app.post("/api/evidence/wipe")
def wipe_evidence():
    """Creator-only: empty the evidence store so the app can re-upload a clean,
    rebuilt set (evidence traced from the actual transactions)."""
    if not is_owner():
        return jsonify(error="Only the creator can rebuild the evidence store."), 403
    con = db()
    for t in ("transcripts", "receipts", "journal", "audit_log"):
        con.execute(f"DELETE FROM {t}")
    con.commit(); con.close()
    for f in FILES.glob("*"):
        try:
            f.unlink()
        except OSError:
            pass
    return jsonify(ok=True)

# ===================== AUTOMATIC BACKUPS =====================
# The books live in browser localStorage; these endpoints keep dated JSON
# copies on disk so a cleared browser is not a lost business.
BACKUPS = DATA_DIR / "backups_v13"
BACKUPS.mkdir(exist_ok=True)

def safe_slug(s, fallback):
    s = re.sub(r"[^A-Za-z0-9_-]", "", str(s or ""))[:60]
    return s or fallback

@app.post("/api/backup")
def backup():
    x = request.get_json(force=True)
    data = x.get("data")
    if not isinstance(data, dict) or "transactions" not in data:
        return jsonify(error="No backup data provided."), 400
    raw = canonical(data)
    if len(raw) > 20_000_000:
        return jsonify(error="Backup too large."), 400
    slug = safe_slug(x.get("profileId"), "profile")
    name = f"{slug}_{datetime.date.today().isoformat()}.json"
    (BACKUPS / name).write_bytes(raw)
    # Keep the newest 14 files per profile.
    files = sorted(BACKUPS.glob(f"{slug}_*.json"))
    for f in files[:-14]:
        f.unlink()
    return jsonify(ok=True, file=name, bytes=len(raw))

@app.get("/api/backup/latest")
def latest_backup():
    """Newest backup for a profile name — lets a login restore its books on any
    device or address."""
    prefix = safe_slug(request.args.get("profile"), "")
    if not prefix:
        return jsonify(error="No profile given."), 400
    files = sorted(BACKUPS.glob(f"{prefix}_*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
    if not files:
        return jsonify(found=False)
    return jsonify(found=True, name=files[0].name, data=json.loads(files[0].read_bytes()))

@app.get("/api/backups")
def list_backups():
    files = sorted(BACKUPS.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
    return jsonify(files=[{"name": f.name, "bytes": f.stat().st_size,
                           "modified": datetime.datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="seconds")}
                          for f in files])

@app.get("/api/backup/<name>")
def get_backup(name):
    if safe_slug(name.replace(".json", ""), "") + ".json" != name:
        return jsonify(error="Bad name."), 400
    return send_from_directory(BACKUPS, name)

@app.get("/evidence_files/<path:name>")
def evidence_file(name):
    return send_from_directory(FILES,name)

@app.post("/api/admin/import-data")
def admin_import_data():
    """Restore a data archive (bookkeep/… and shop-uploads/…) onto this server.
    Enabled only while ALLOW_DATA_IMPORT=1 is set, and only with the server secret."""
    import tarfile
    if os.environ.get("ALLOW_DATA_IMPORT") != "1":
        return jsonify(error="Import is switched off."), 404
    if request.headers.get("Authorization", "") != f"Bearer {app.secret_key}":
        return jsonify(error="Not allowed."), 403
    roots = {"bookkeep": DATA_DIR,
             "shop-uploads": Path(os.environ.get("SHOP_UPLOADS_DIR") or (SHOP_DIR / ".uploads"))}
    written = 0
    with tarfile.open(fileobj=io.BytesIO(request.get_data()), mode="r:*") as tar:
        for m in tar.getmembers():
            parts = Path(m.name).parts
            if not parts or parts[0] not in roots or ".." in parts or m.name.startswith("/"):
                continue
            dest = roots[parts[0]].joinpath(*parts[1:]) if len(parts) > 1 else None
            if dest is None:
                continue
            if m.isdir():
                dest.mkdir(parents=True, exist_ok=True)
            elif m.isfile():
                dest.parent.mkdir(parents=True, exist_ok=True)
                with tar.extractfile(m) as src, open(dest, "wb") as out:
                    out.write(src.read())
                written += 1
    return jsonify(ok=True, files=written)

init_db()                      # also under gunicorn, where __main__ never runs

if __name__=="__main__":
    # second listener so the website itself can be opened on this Mac:
    #   http://127.0.0.1:5000  → BookKeep app      (books.hardywu.com)
    #   http://127.0.0.1:5001  → the website       (hardywu.com)
    # 0.0.0.0 so phones and tablets on the same Wi-Fi can open the site directly,
    # bypassing the home filter that blocks the hardywu.com name.
    # (BookKeep on 5000 stays private to this Mac.)
    threading.Thread(target=lambda: app.run(host="0.0.0.0", port=SITE_PORT,
                                            debug=False, use_reloader=False),
                     daemon=True).start()
    app.run(host="127.0.0.1",port=5000,debug=False)
