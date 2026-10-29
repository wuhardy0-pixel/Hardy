from __future__ import annotations
from flask import Flask, request, jsonify, send_from_directory, session, redirect
from pathlib import Path
from datetime import timedelta
import os, io, re, shutil, atexit, sqlite3, json, hashlib, base64, datetime, uuid, hmac, secrets, time, threading, html

# Load API keys from .env (server-side only — never sent to the browser).
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

BASE = Path(__file__).resolve().parent            # company/corporate — the server
COMPANY = BASE.parent                              # company/ — site, products, corporate
SITE_DIR = COMPANY / "site"                        # hardywu.com pages, images, the shop
IMG_DIR = SITE_DIR / "images"
APP_DIR = COMPANY / "products" / "apps" / "bookkeep"   # the BookKeep front-end files
GAMES_DIR = COMPANY / "products" / "games"
# Lasting data (books, evidence, backups, visitor log). On a hosting service this
# points at the mounted volume so it survives redeploys; locally it's this folder.
DATA_DIR = Path(os.environ.get("BOOKKEEP_DATA_DIR") or (BASE / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB = DATA_DIR / "bookkeep_v13.db"
FILES = DATA_DIR / "evidence_files_v13"
# On Cloud Run the data folder is a mounted storage bucket: fine for files, not
# for a live SQLite database. So the database works from local disk and a
# consistent snapshot is mirrored to the bucket after every change.
DB_STORE = DB
if os.environ.get("BOOKKEEP_DB_LOCAL"):
    DB = Path(os.environ["BOOKKEEP_DB_LOCAL"]); DB.parent.mkdir(parents=True, exist_ok=True)
    if DB_STORE.exists() and not DB.exists():
        shutil.copy2(DB_STORE, DB)
_db_synced = [0.0]
def sync_db_to_store(force=False):
    if DB == DB_STORE or not DB.exists():
        return
    try:
        m = DB.stat().st_mtime
        if m <= _db_synced[0] and not force:
            return
        snap = DB.with_suffix(".snap")
        src = sqlite3.connect(DB); dst = sqlite3.connect(snap); src.backup(dst); dst.close(); src.close()
        tmp = DB_STORE.with_suffix(".tmp"); shutil.copy2(snap, tmp); os.replace(tmp, DB_STORE)
        _db_synced[0] = m
    except Exception as e:
        print("db sync to store failed:", e, flush=True)
atexit.register(lambda: sync_db_to_store(force=True))
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
PORTFOLIO_HOSTS = {"hardywu.com", "www.hardywu.com", "play.hardywu.com"}   # play. = the games
APP_HOST = "https://bookkeep.hardywu.com"   # books.hardywu.com still works as an alias

PORTFOLIO = {
    # hidden: not on the front page or the menu for the public; the pages still work by address, and the family sees an Apps link
    "apps": {"title": "Apps", "emoji": "📱", "blurb": "Software built by Hardy Wu.", "hidden": True,
        "items": {
            "bookkeep": {"name": "BookKeep", "emoji": "📒", "redirect": APP_HOST, "img": "/item/bookkeep.png",
                "desc": "An AI bookkeeper you can talk to — double-entry accounting, evidence, statements, and margins."},
            "news-tracker": {"name": "News Tracker", "emoji": "📰",
                "desc": "Follow the topics you care about. Fresh headlines for each, what's new since you last looked, saved stories, and a one-minute AI briefing.",
                "link": "/news", "link_label": "Open"},
        }},
    "games": {"title": "Video Games", "emoji": "🎮", "blurb": "Games built by Hardy Wu — play them free.",
        "items": {
            "football-sim": {"name": "Football Sim", "emoji": "⚽", "img": "/item/footballsim.png",
                "desc": "An original 3D football simulation — broadcast-style play, fictional clubs and stadiums.",
                "link": "/play/fifa/", "link_label": "Play"},
            "nova-blast": {"name": "Nova Blast", "emoji": "🚀", "img": "/item/nova.png",
                "desc": "A neon space shooter — waves of raiders, asteroids, power-ups and a boss every fifth wave.",
                "link": "/play/nova", "link_label": "Play"},
            "critter-quest": {"name": "Critter Quest", "emoji": "⚡", "img": "/item/quest.png",
                "desc": "Four regions, a town with a shop and healer, MP-powered special moves — 32 critters to catch and evolve, ranked F to SSS.",
                "link": "/play/quest", "link_label": "Play"},
            "zheng-shang-you": {"name": "争上游 Zheng Shang You", "emoji": "🀄",
                "desc": "The family card game: singles, pairs, three-of-a-kind bombs, four-of-a-kind bigger bombs, and the two jokers beat all. 2–5 players, on your phone.",
                "link": "/play/zsy", "link_label": "Play"},
            "elemental-latin": {"name": "Elemental Latin", "emoji": "🔥",
                "desc": "Elemental powers with Latin names. Throw fire with “ignem iacio” — only if the endings are right. A 3D world you walk through; spells that spray real fire, water and lightning. Duel human rivals in the arena, tame wild creatures by calling them in the vocative, forge your own skills.",
                "link": "/play/latin", "link_label": "Play"},
            "elementum": {"name": "Elementum", "emoji": "🏃",
                "desc": "Step 1 of a new 3D game: a body that walks, runs, turns, jumps and climbs blocks in a gray world, with a camera that follows behind. Keyboard + mouse, or joystick on a phone.",
                "link": "/play/elementum", "link_label": "Play"},
            "nova-strike": {"name": "Nova Strike", "emoji": "🚀", "img": "/item/novastrike.png",
                "desc": "A fast-paced space shooter on itch.io.",
                "link": "https://hardywu.itch.io/ns", "link_label": "Play"},
            "cmind-freecell": {"name": "C-Mind FreeCell", "emoji": "🃏", "img": "/item/freecell.png",
                "desc": "A calm game of FreeCell — a quiet moment, one deal at a time. On itch.io.",
                "link": "https://hardywu.itch.io/cmind-freecell", "link_label": "Play"},
            "pokemon-adventure": {"name": "Pokémon Adventure", "emoji": "⚡", "img": "/item/pokemonadv.png",
                "desc": "An adventure through a world of creatures to catch and battle, on itch.io.",
                "link": "https://hardywu.itch.io/pa", "link_label": "Play"},
        }},
    "3d": {"title": "Shop", "emoji": "🛍️",   # the shop: 3D prints now, robots join it when they are ready
        "blurb": "3D prints and robots, made to order — pick your colors and see it before you buy.",
        "items": {}},  # filled from the shop catalog below
    "robotics": {"title": "Robotics", "emoji": "🤖", "blurb": "Robot projects. Coming soon.", "hidden": True,   # part of the Shop now
        "items": {}},
}

# Real catalog from Hardy's 3D Business (names, prices, photos).
SHOP_DIR = SITE_DIR / "shop"
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
        "desc": f'{_p.get("description","")} — ${_p["price"]:.2f}' + ("" if _p.get("in_stock", True) else " · SOLD OUT"),
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
    if not p.get("in_stock", True):
        return jsonify(error="Sorry, this product is sold out right now."), 400
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
    con.execute("""INSERT INTO orders(id,product,product_name,qty,price_each,total,color,custom_text,buyer,status,created_at,
                                      visitor_name,visitor_email,buyer_email,source)
                   VALUES(?,?,?,?,?,?,?,?,?,'ordered',?,?,?,?,'site')""",
                (oid, slug, p["name"], qty, float(p["price"]), total, color, custom, buyer, now_iso(),
                 session.get("v_name") or "", visitor() or "", str(x.get("email") or "").strip()[:90]))
    add_print_job(con, oid, p["name"], qty, color, custom, buyer)
    con.commit(); con.close()
    return jsonify(ok=True, order=oid, total=total, name=p["name"])

ORDER_STATUSES = ("ordered", "printed", "shipped", "returned", "cancelled")
JOB_STATUSES = ("todo", "printing", "done")

def add_print_job(con, oid, product_name, qty, color, custom_text, buyer):
    """Every order automatically becomes a task on the 3D-printer queue."""
    con.execute("""INSERT INTO print_jobs(id,order_id,product_name,qty,color,custom_text,buyer,status,created_at)
                   VALUES(?,?,?,?,?,?,?,'todo',?)""",
                ("PJ_" + uuid.uuid4().hex[:10], oid, product_name, qty, color, custom_text, buyer, now_iso()))

# ============================ AI shopping agents =============================
# Machine-readable catalogue + a checkout an AI agent (ChatGPT, Meta's Muse, Claude…)
# can call without a browser or a sign-in. Orders land in the same orders table and
# print queue as everything else, marked source='agent'. No card is taken: Barbara
# emails the buyer to arrange payment and shipping, exactly like site orders today.
SHIPPING_CENTS = int(_cat.get("shippingCents") or 0)
ADDONS = {k: float(v) for k, v in (_cat.get("addons") or {"text": 2, "image": 2, "extraColor": 2}).items()}   # dollars, same as the shop
ADDON = ADDONS.get("extraColor", 2.0)
SHIP_TEXT = "Free shipping within the US" if SHIPPING_CENTS == 0 else f"Flat ${SHIPPING_CENTS/100:.2f} within the US"

def product_feed():
    items = []
    for slug, p in SHOP_PRODUCTS.items():
        photos = [SITE_ORIGIN.replace("hardywu.com", "play.hardywu.com") + "/products/" + ph.split("/products/")[-1]
                  if not ph.startswith("http") else ph for ph in (p.get("photos") or [])]
        items.append({
            "id": slug, "offer_id": slug, "title": p["name"],
            "description": p.get("description", ""),
            "link": f"https://shop.hardywu.com/products/{slug}",
            "image_link": photos[0] if photos else None, "additional_image_link": photos[1:],
            "price": f"{float(p['price']):.2f} {_cat.get('currency','usd').upper()}",
            "availability": "in_stock" if p.get("in_stock", True) else "out_of_stock", "condition": "new", "brand": "Hardy Wu",
            "made_to_order": True, "product_type": "3D print",
            "variant_attributes": {"color": SHOP_COLORS, "zones": p.get("zones") or ["Color"]},
            "customizations": {"custom_text": bool(p.get("text")), "custom_image": bool(p.get("image")),
                               "addon_price": f"text +{ADDONS.get('text',2):.2f} USD, image +{ADDONS.get('image',2):.2f} USD, each extra colour +{ADDONS.get('extraColor',2):.2f} USD"},
            "shipping": {"price": f"{SHIPPING_CENTS/100:.2f} USD", "countries": ["US"]},
            "seller": {"name": "Hardy Wu", "url": SITE_ORIGIN, "contact": OWNER_EMAIL},
            "checkout": {"method": "POST", "url": "https://play.hardywu.com/api/agent/order",
                         "spec": "https://play.hardywu.com/openapi.json"},
        })
    return items

@app.get("/api/products")
def api_products():
    return jsonify(shop="Hardy's 3D", currency=_cat.get("currency", "usd"), updated=now_iso(),
                   products=product_feed(),
                   policies={"payment": "No card is taken online. Hardy emails the buyer to arrange payment (pay on delivery).",
                             "shipping": SHIP_TEXT + ", made to order.",
                             "returns": "Contact " + OWNER_EMAIL + "."})

OPENAPI = None
def openapi_doc():
    global OPENAPI
    if OPENAPI is None:
        OPENAPI = {
          "openapi": "3.1.0",
          "info": {"title": "Hardy Wu shop — agent checkout", "version": "1.0",
                   "description": "Buy Hardy Wu's 3D-printed products on behalf of a person. List products with GET /api/products, then place the order with POST /api/agent/order. No payment is taken online; Hardy emails the buyer to arrange payment and shipping. Be honest about who the buyer is."},
          "servers": [{"url": "https://play.hardywu.com"}],
          "paths": {
            "/api/products": {"get": {"summary": "Product catalogue with prices, colours and customisation options", "responses": {"200": {"description": "JSON list of products"}}}},
            "/api/agent/order": {"post": {"summary": "Place an order for a person",
              "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object",
                "required": ["product", "buyer_name", "buyer_email"],
                "properties": {
                  "product": {"type": "string", "description": "product id from /api/products"},
                  "qty": {"type": "integer", "minimum": 1, "maximum": 9, "default": 1},
                  "color": {"type": "string", "description": "one of the colours in /api/products (or one per zone: 'Body: Black · Markings: Purple')"},
                  "custom_text": {"type": "string", "maxLength": 30, "description": "engraved text, only for products with custom_text"},
                  "buyer_name": {"type": "string"}, "buyer_email": {"type": "string", "format": "email"},
                  "phone": {"type": "string"}, "ship_to": {"type": "string", "description": "full postal address, US only"},
                  "note": {"type": "string", "maxLength": 300},
                  "agent": {"type": "string", "description": "which AI agent is ordering, e.g. 'Meta Muse' or 'ChatGPT'"}}}}}},
              "responses": {"200": {"description": "{ok, order (id), total, status:'ordered', next:'Hardy will email the buyer to arrange payment'}"},
                            "400": {"description": "{error} — what is missing or wrong"}, "429": {"description": "too many orders from this address; try later"}}}}}}
    return OPENAPI

@app.get("/openapi.json")
def openapi_json():
    return jsonify(openapi_doc())

LLMS_TXT = None
def llms_txt():
    lines = ["# Hardy Wu — hardywu.com", "",
             "> Hardy Wu is a young maker. hardywu.com has his free browser games, the BookKeep bookkeeping app, "
             "and a small shop of 3D-printed products he prints to order. AI agents are welcome to browse and to buy on behalf of a person.", "",
             "## Shop (AI agents can order here)",
             "- Catalogue (JSON): https://play.hardywu.com/api/products",
             "- Universal Commerce Protocol (ucp.dev): profile https://hardywu.com/.well-known/ucp · REST https://play.hardywu.com/ucp · MCP (JSON-RPC tools) https://play.hardywu.com/ucp/mcp",
             "- Flow for agents: search_catalog → create_cart / update_cart (add, change, remove) → create_checkout with buyer + US address → send the buyer to continue_url to APPROVE → poll get_checkout until completed. Nothing is ordered without the buyer's approval.",
             "- Simpler order API (OpenAPI): https://play.hardywu.com/openapi.json — POST https://play.hardywu.com/api/agent/order",
             "- Human storefront: https://shop.hardywu.com (asks for a name and email first)",
             f"- Payment: none taken online. Hardy emails the buyer to arrange payment. {SHIP_TEXT}, US only. Contact {OWNER_EMAIL}.", "",
             "## Products"]
    for p in product_feed():
        lines.append(f"- {p['title']} — {p['price']}{' — SOLD OUT' if p['availability'] != 'in_stock' else ''}: {p['description']} (colours: {', '.join(p['variant_attributes']['color'])}) → {p['link']}")
    lines += ["", "## Games (free, in the browser, sign in with a name and email)",
              "- https://hardywu.com/games", "", "## Apps", "- BookKeep: https://bookkeep.hardywu.com — speak-it, snap-it bookkeeping", "",
              "## Robotics", "- https://hardywu.com/robotics"]
    return "\n".join(lines) + "\n"

@app.get("/llms.txt")
def llms_route():
    return app.response_class(llms_txt(), mimetype="text/plain")

ROBOTS_TXT = """# hardywu.com welcomes people and AI agents alike.
User-agent: *
Allow: /
# AI agents: the catalogue and an order API are described here
# https://hardywu.com/llms.txt
Sitemap: https://hardywu.com/sitemap.xml
Sitemap: https://hardywu.com/sitemap.txt
# AI agents are welcome (OpenAI, Anthropic, Google, Meta, Perplexity …)
User-agent: GPTBot
User-agent: ChatGPT-User
User-agent: OAI-SearchBot
User-agent: ClaudeBot
User-agent: Claude-User
User-agent: Google-Extended
User-agent: Meta-ExternalAgent
User-agent: PerplexityBot
Allow: /
"""
@app.get("/robots.txt")
def robots_route():
    return app.response_class(ROBOTS_TXT, mimetype="text/plain")

_agent_hits = {}
def agent_rate_ok(ip, limit=10, window=3600):
    import time
    if request.headers.get("X-Hardy-Public-Host") and request.headers.get("X-Hardy-Client-IP"):
        ip = request.headers["X-Hardy-Client-IP"][:64]          # the store's proxy tells us who really asked
    now = time.time()
    hits = [t for t in _agent_hits.get(ip, []) if now - t < window]
    if len(hits) >= limit:
        _agent_hits[ip] = hits; return False
    hits.append(now); _agent_hits[ip] = hits; return True

@app.post("/api/agent/order")
def agent_order():
    if not agent_rate_ok(request.remote_addr or "?"):
        return jsonify(error="Too many orders from this address. Please try again later."), 429
    x = request.get_json(silent=True) or {}
    slug = str(x.get("product") or "").strip()
    p = SHOP_PRODUCTS.get(slug)
    if not p:
        return jsonify(error="Unknown product. Use an id from https://play.hardywu.com/api/products."), 400
    if not p.get("in_stock", True):
        return jsonify(error="Sorry, this product is sold out right now."), 400
    try:
        qty = int(x.get("qty") or 1)
    except (TypeError, ValueError):
        qty = 0
    if not (1 <= qty <= 9):
        return jsonify(error="qty must be between 1 and 9."), 400
    buyer = str(x.get("buyer_name") or "").strip()[:60]
    email = str(x.get("buyer_email") or "").strip().lower()[:90]
    if not buyer or "@" not in email or "." not in email.split("@")[-1]:
        return jsonify(error="buyer_name and a real buyer_email are required so Hardy can reach the buyer."), 400
    color = str(x.get("color") or "").strip()[:80]
    if not color:
        return jsonify(error="Pick a color: " + ", ".join(SHOP_COLORS) + "."), 400
    zones = p.get("zones") or ["Color"]
    parts = [c.strip() for c in re.split(r"[·,;]", color)] if len(zones) > 1 else [color]
    names = [(c.split(":", 1)[1] if ":" in c else c).strip() for c in parts]
    bad = [n for n in names if n not in SHOP_COLORS]
    if bad:
        return jsonify(error=f"Unknown color {bad[0]!r}. Choose from: " + ", ".join(SHOP_COLORS) + "."), 400
    custom = str(x.get("custom_text") or "").strip()[:30]
    if custom and not p.get("text"):
        return jsonify(error="This product does not take custom text."), 400
    extra_colours = max(0, len(set(names)) - 1)
    unit = round(float(p["price"]) + (ADDONS.get("text", 2) if custom else 0) + ADDONS.get("extraColor", 2) * extra_colours, 2)
    total = round(unit * qty + SHIPPING_CENTS / 100, 2)
    ship_to = str(x.get("ship_to") or "").strip()[:300]
    phone = str(x.get("phone") or "").strip()[:40]
    agent = (str(x.get("agent") or "").strip() or (request.headers.get("User-Agent") or ""))[:80]
    note = str(x.get("note") or "").strip()[:300]
    details = " · ".join(b for b in ([f"Text: “{custom}”"] if custom else []) + ([f"Note: {note}"] if note else []))[:300]
    oid = "O_" + uuid.uuid4().hex[:10]
    con = db()
    con.execute("""INSERT INTO orders(id,product,product_name,qty,price_each,total,color,custom_text,buyer,status,created_at,
                                      visitor_name,visitor_email,buyer_email,source,ship_to,phone,agent)
                   VALUES(?,?,?,?,?,?,?,?,?,'ordered',?,?,?,?,'agent',?,?,?)""",
                (oid, slug, p["name"], qty, unit, total, color, details, buyer, now_iso(),
                 "", "", email, ship_to, phone, agent))
    add_print_job(con, oid, p["name"], qty, color, details, buyer)
    con.commit(); con.close()
    if mail_configured():
        send_mail(OWNER_EMAIL, f"New order {oid} from an AI agent ({agent or 'unknown'}): {qty} × {p['name']}",
                  f"{buyer} <{email}> {phone}\nShip to: {ship_to or '(not given)'}\n\n{qty} × {p['name']} · {color}{(' · ' + details) if details else ''}\n"
                  f"Total ${total:.2f} (incl. ${SHIPPING_CENTS/100:.2f} shipping). No payment taken — email the buyer.\n\n{SITE_ORIGIN}/orders")
    return jsonify(ok=True, order=oid, product=p["name"], qty=qty, color=color, price_each=unit,
                   shipping=SHIPPING_CENTS / 100, total=total, currency=_cat.get("currency", "usd").upper(),
                   status="ordered", next=f"Hardy will email {email} to arrange payment and shipping. Questions: {OWNER_EMAIL}.")

# ============================ Universal Commerce Protocol ====================
# The open standard Shopify and Google published (ucp.dev) so AI shopping agents
# can find a store's catalogue, build a cart and check out. Hardy's own
# implementation of two transports — REST at /ucp and MCP (JSON-RPC tools) at
# /ucp/mcp — plus a profile at /.well-known/ucp. Three rules of the house:
#   1. carts are free to build: add, change, remove, cancel;
#   2. a checkout never places an order by itself — the buyer (a person) must
#      open continue_url, see the summary, and press Approve (requires_escalation);
#   3. no card is taken online (payment_handlers is empty): Hardy emails the buyer.
UCP_VERSION = "2026-08-25"
UCP_BASE = "https://play.hardywu.com/ucp"
def ucp_public_base():
    """Where this profile says its endpoints live. Through the store's proxy (shop.hardywu.com)
    the paths are the ones Shopify's own agent hard-codes: /api/ucp/mcp and /api/mcp."""
    h = (request.headers.get("X-Hardy-Public-Host") or "").lower()
    return ("https://shop.hardywu.com/api/ucp", "https://shop.hardywu.com/api/ucp/mcp") if h == "shop.hardywu.com" else (UCP_BASE, UCP_BASE + "/mcp")
UCP_LINKS = [{"type": t, "url": "https://hardywu.com/terms"} for t in ("terms_of_service", "refund_policy", "privacy_policy")]
UCP_CAPS_ALL = ["dev.ucp.shopping.catalog.search", "dev.ucp.shopping.catalog.lookup", "dev.ucp.shopping.cart",
                "dev.ucp.shopping.checkout", "dev.ucp.shopping.fulfillment"]

def _cslug(c): return re.sub(r"[^a-z0-9]+", "-", c.lower()).strip("-")
def ucp_variant_id(slug, colour): return f"{slug}__{_cslug(colour)}"
def ucp_parse_variant(vid):
    slug, _, cs = str(vid or "").partition("__")
    p = SHOP_PRODUCTS.get(slug)
    if not p: return None, None
    colour = next((c for c in SHOP_COLORS if _cslug(c) == cs), None)
    return p, colour

def ucp_product(slug, p):
    photos = ["https://play.hardywu.com/products/" + ph.split("/products/")[-1] for ph in (p.get("photos") or [])]
    cents = int(round(float(p["price"]) * 100)); ok = bool(p.get("in_stock", True))
    media = [{"type": "image", "url": u, "alt_text": p["name"]} for u in photos]
    avail = {"available": ok, "status": "in_stock" if ok else "out_of_stock"}
    variants = [{"id": ucp_variant_id(slug, c), "sku": f"{slug}-{_cslug(c)}".upper(), "title": c,
                 "description": {"plain": f"{p['name']} in {c}"}, "price": {"amount": cents, "currency": "USD"},
                 "availability": avail, "options": [{"name": "Color", "label": c}], "media": media,
                 "seller": {"name": "Hardy Wu", "links": UCP_LINKS}} for c in SHOP_COLORS]
    return {"id": slug, "handle": slug, "title": p["name"], "description": {"plain": p.get("description", "")},
            "url": f"https://shop.hardywu.com/products/{slug}", "categories": [{"value": "3D prints", "taxonomy": "merchant"}],
            "price_range": {"min": {"amount": cents, "currency": "USD"}, "max": {"amount": cents, "currency": "USD"}},
            "media": media, "options": [{"name": "Color", "values": [{"label": c} for c in SHOP_COLORS]}],
            "variants": variants, "tags": ["3d-print", "made-to-order"] + ([] if ok else ["sold-out"]),
            "metadata": {"made_to_order": True, "in_stock": ok, "custom_text_available": bool(p.get("text")),
                         "shipping": SHIP_TEXT.lower()}}

def ucp_env(caps):
    return {"version": UCP_VERSION, "capabilities": {c: [{"version": UCP_VERSION}] for c in caps}, "payment_handlers": {}}
def ucp_err(code, content, status=200):
    return {"ucp": {"version": UCP_VERSION, "status": "error"},
            "messages": [{"type": "error", "code": code, "content": content, "severity": "unrecoverable"}],
            "continue_url": "https://shop.hardywu.com/"}, status
def _exp(hours):
    import datetime as _dt
    return (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(hours=hours)).isoformat()

# ---- catalogue
def core_search(req):
    q = str((req or {}).get("query") or "").lower().split()
    items = [ucp_product(s, p) for s, p in SHOP_PRODUCTS.items()
             if not q or any(w in f"{p['name']} {p.get('description','')} 3d print".lower() for w in q)]
    pf = ((req or {}).get("filters") or {}).get("price") or {}
    if pf.get("max") is not None: items = [i for i in items if i["price_range"]["min"]["amount"] <= int(pf["max"])]
    if pf.get("min") is not None: items = [i for i in items if i["price_range"]["max"]["amount"] >= int(pf["min"])]
    return {"ucp": ucp_env(["dev.ucp.shopping.catalog.search"]), "products": items,
            "pagination": {"has_next_page": False, "total_count": len(items)}}, 200
def core_lookup(req):
    out, seen = [], set()
    for vid in ((req or {}).get("ids") or [])[:50]:
        slug = str(vid).partition("__")[0]
        if slug in SHOP_PRODUCTS and slug not in seen: seen.add(slug); out.append(ucp_product(slug, SHOP_PRODUCTS[slug]))
    return {"ucp": ucp_env(["dev.ucp.shopping.catalog.lookup"]), "products": out}, 200
def core_product(req):
    vid = str((req or {}).get("id") or (req or {}).get("handle") or "")
    slug = vid.partition("__")[0]
    if slug not in SHOP_PRODUCTS: return ucp_err("not_found", "No such product.")
    prod = ucp_product(slug, SHOP_PRODUCTS[slug])
    p, colour = ucp_parse_variant(vid)
    if colour:                                   # asked for one colour: answer as that selected variant
        v = next(x for x in prod["variants"] if x["id"] == vid)
        prod = dict(prod, id=vid, title=f"{prod['title']} — {colour}", variants=[v], metadata=dict(prod["metadata"], product_id=slug, selected_variant=vid))
    return {"ucp": ucp_env(["dev.ucp.shopping.catalog.lookup"]), "product": prod}, 200

# ---- line items (shared by carts and checkouts)
def ucp_lines(req):
    msgs, lines = [], []
    for i, li in enumerate(((req or {}).get("line_items") or [])[:20]):
        item = li.get("item") or {}
        p, colour = ucp_parse_variant(item.get("id"))
        path = f"$.line_items[{i}].item.id"
        if not p:
            msgs.append({"type": "error", "code": "invalid", "path": path, "severity": "recoverable",
                         "content": f"Unknown item {item.get('id')!r}. Use a variant id from catalog search, e.g. crab-gauge__black."}); continue
        if not p.get("in_stock", True):
            msgs.append({"type": "error", "code": "out_of_stock", "path": path, "severity": "recoverable",
                         "content": f"{p['name']} is sold out right now."}); continue
        if not colour:
            slug = str(item["id"]).partition("__")[0]
            msgs.append({"type": "error", "code": "invalid", "path": path, "severity": "recoverable",
                         "content": "Pick a colour variant: " + ", ".join(ucp_variant_id(slug, c) for c in SHOP_COLORS)}); continue
        try: qty = min(9, int(li.get("quantity") if li.get("quantity") is not None else 1))
        except (TypeError, ValueError): qty = 1
        if qty <= 0: continue                                   # quantity 0 = remove the line (Shopify's cart convention)
        cents = int(round(float(p["price"]) * 100)); slug = str(item["id"]).partition("__")[0]
        lines.append({"id": li.get("id") or f"li_{i+1}", "item": {"id": item["id"], "title": f"{p['name']} — {colour}", "price": cents,
                      "image_url": (ucp_product(slug, p)["media"] or [{}])[0].get("url")}, "quantity": qty,
                      "totals": [{"type": "subtotal", "amount": cents * qty}, {"type": "total", "amount": cents * qty}],
                      "_slug": slug, "_colour": colour})
    return lines, msgs
def _public(d):
    out = {k: v for k, v in d.items() if not k.startswith("_") and v is not None}
    out["line_items"] = [{k: v for k, v in l.items() if not k.startswith("_")} for l in d["line_items"]]
    return out

# ---- carts (table ucp_carts: id, data, expires_at)
def _cart_load(cid):
    con = db(); r = con.execute("SELECT data FROM ucp_carts WHERE id=?", (cid,)).fetchone(); con.close()
    return json.loads(r["data"]) if r else None
def _cart_save(d):
    con = db(); con.execute("INSERT OR REPLACE INTO ucp_carts(id,data,expires_at) VALUES(?,?,?)", (d["id"], json.dumps(d), d["expires_at"])); con.commit(); con.close()
def cart_build(cid, req, prev=None):
    lines, msgs = ucp_lines(req)
    sub = sum(l["totals"][0]["amount"] for l in lines); ship = SHIPPING_CENTS if lines else 0
    buyer = {k: str(v)[:80] for k, v in ((req or {}).get("buyer") or {}).items() if k in ("first_name", "last_name", "email", "phone_number") and v}
    return {"ucp": ucp_env(["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]), "id": cid, "line_items": lines,
            "buyer": buyer or None, "currency": "USD", "messages": msgs, "links": UCP_LINKS,
            "totals": [{"type": "subtotal", "amount": sub}, {"type": "fulfillment", "display_text": "Shipping (US, flat)", "amount": ship},
                       {"type": "total", "amount": sub + ship, "display_text": "Estimated total"}],
            "continue_url": f"https://shop.hardywu.com/?cart={cid}", "expires_at": (prev or {}).get("expires_at") or _exp(24 * 7),
            "_status": (prev or {}).get("_status", "open")}
def core_cart_create(cart):
    d = cart_build("cart_" + uuid.uuid4().hex[:12], cart); _cart_save(d); return _public(d), 201
def core_cart_get(cid):
    d = _cart_load(cid); return (_public(d), 200) if d else ucp_err("not_found", "No such cart.")
def core_cart_update(cid, cart):
    prev = _cart_load(cid)
    if not prev: return ucp_err("not_found", "No such cart.")
    if prev.get("_status") == "canceled": return ucp_err("invalid", "This cart was cancelled. Create a new one.")
    d = cart_build(cid, cart, prev); _cart_save(d); return _public(d), 200
def core_cart_cancel(cid):
    d = _cart_load(cid)
    if not d: return ucp_err("not_found", "No such cart.")
    d["_status"] = "canceled"; d["line_items"] = []; d["totals"] = [{"type": "subtotal", "amount": 0}, {"type": "total", "amount": 0}]
    d["messages"] = [{"type": "info", "code": "canceled", "content": "Cart cancelled."}]; _cart_save(d); return _public(d), 200

# ---- checkout sessions (table ucp_sessions)
def _chk_load(sid):
    con = db(); r = con.execute("SELECT data, expires_at FROM ucp_sessions WHERE id=?", (sid,)).fetchone(); con.close()
    if not r: return None
    d = json.loads(r["data"])
    if r["expires_at"] < now_iso() and d["status"] not in ("completed",): d["status"] = "canceled"
    return d
def _chk_save(d):
    con = db(); con.execute("INSERT OR REPLACE INTO ucp_sessions(id,data,created_at,expires_at) VALUES(?,?,?,?)",
                            (d["id"], json.dumps(d), d.get("_created") or now_iso(), d["expires_at"])); con.commit(); con.close()
APPROVE_SECONDS = 6 * 3600                 # the approval link's code lives as long as the checkout
APPROVAL_MSG = {"type": "error", "code": "buyer_approval_required", "path": "$", "severity": "requires_buyer_review",
                "content": "Hardy's shop never places an order without the buyer. Give the buyer continue_url (it is private to this checkout and works until the "
                           "checkout expires). The buyer opens it, signs in with their own email, reviews the summary and presses Approve; "
                           "then poll this checkout until status is completed."}
def _fresh_code(d):
    """A private code in the approval link, good for the life of the checkout. Minted once; reads keep it."""
    import secrets, time
    if d.get("_code") and time.time() <= float(d["_code"].get("exp") or 0):
        d["continue_url"] = f"https://play.hardywu.com/approve/{d['id']}?code={d['_code']['code']}"; return d
    d["_code"] = {"code": f"{secrets.randbelow(10**6):06d}", "exp": time.time() + APPROVE_SECONDS}
    d["continue_url"] = f"https://play.hardywu.com/approve/{d['id']}?code={d['_code']['code']}"
    return d
def _code_valid(d, code):
    import time, hmac
    c = d.get("_code") or {}
    return bool(code) and time.time() <= float(c.get("exp") or 0) and hmac.compare_digest(str(c.get("code")), str(code))

def chk_build(sid, req, prev=None):
    req = dict(req or {})
    if req.get("cart_id"):
        cart = _cart_load(req["cart_id"])
        if cart:
            req["line_items"] = [{"id": l["id"], "item": {"id": l["item"]["id"]}, "quantity": l["quantity"]} for l in cart["line_items"]]
            if cart.get("buyer") and not req.get("buyer"): req["buyer"] = cart["buyer"]
    lines, msgs = ucp_lines(req)
    if not lines and not msgs:
        msgs.append({"type": "error", "code": "missing", "path": "$.line_items", "content": "Add at least one line item.", "severity": "recoverable"})
    sub = sum(l["totals"][0]["amount"] for l in lines); ship = SHIPPING_CENTS if lines else 0
    buyer = {k: str(v)[:80] for k, v in (req.get("buyer") or {}).items() if k in ("first_name", "last_name", "email", "phone_number") and v}
    if not buyer.get("email"):
        msgs.append({"type": "error", "code": "missing", "path": "$.buyer.email", "content": "Buyer email is required so Hardy can arrange payment.", "severity": "recoverable"})
    f_req = ((req.get("fulfillment") or {}).get("methods") or [{}])[0]
    dests = [{k: str(d.get(k) or "")[:120] for k in ("street_address", "extended_address", "address_locality", "address_region", "postal_code", "address_country")}
             | {"type": "shipping_address", "id": d.get("id") or f"dest_{j+1}"} for j, d in enumerate((f_req.get("destinations") or [])[:5])]
    sel = f_req.get("selected_destination_id") or (dests[0]["id"] if dests else None)
    dest = next((d for d in dests if d["id"] == sel), None)
    if not dest or not all(dest.get(k) for k in ("street_address", "address_locality", "address_region", "postal_code", "address_country")):
        msgs.append({"type": "error", "code": "missing", "path": "$.fulfillment.methods[0].selected_destination_id", "severity": "recoverable",
                     "content": "A full US shipping address is required (street, city, state, postal code, country)."})
    elif dest.get("address_country", "").upper() not in ("US", "USA", "UNITED STATES"):
        msgs.append({"type": "error", "code": "invalid", "path": "$.fulfillment.methods[0].destinations", "content": "We only ship within the US for now.", "severity": "recoverable"})
    ids = [l["id"] for l in lines]
    fulfillment = {"methods": [{"id": "shipping", "type": "shipping", "line_item_ids": ids, "destinations": dests, "selected_destination_id": sel,
                                "groups": [{"id": "package_1", "line_item_ids": ids, "selected_option_id": "flat",
                                            "options": [{"id": "flat", "title": "Flat shipping", "description": {"plain": "Printed to order, then shipped within the US"},
                                                         "totals": [{"type": "fulfillment", "amount": ship}, {"type": "total", "amount": ship}]}]}]}]}
    recoverable = [m for m in msgs if m["type"] == "error"]
    if prev and prev.get("status") in ("completed", "canceled"): status = prev["status"]
    elif recoverable: status = "incomplete"
    else: status = "requires_escalation"; msgs.append(APPROVAL_MSG)
    msgs.append({"type": "info", "code": "payment_offline", "content": "No card is charged online. After the buyer approves, Hardy emails them to arrange payment (pay on delivery)."})
    d = {"ucp": ucp_env(["dev.ucp.shopping.checkout", "dev.ucp.shopping.fulfillment"]), "id": sid, "status": status, "currency": "USD",
         "line_items": lines, "buyer": buyer, "fulfillment": fulfillment, "messages": msgs, "links": UCP_LINKS,
         "totals": [{"type": "subtotal", "amount": sub}, {"type": "fulfillment", "display_text": "Shipping", "amount": ship}, {"type": "total", "amount": sub + ship}],
         "expires_at": (prev or {}).get("expires_at") or _exp(6), "order": (prev or {}).get("order"),
         "continue_url": f"https://play.hardywu.com/approve/{sid}",
         "_created": (prev or {}).get("_created") or now_iso(), "_cart_id": req.get("cart_id") or (prev or {}).get("_cart_id"),
         "_agent": (prev or {}).get("_agent"), "_code": (prev or {}).get("_code")}
    return d
def _out(d):
    """Hand a checkout back to the agent; if it is waiting for the buyer, mint a fresh 30-second approval link first."""
    if d["status"] in ("incomplete", "requires_escalation"):
        _fresh_code(d); _chk_save(d)
    return _public(d)
def core_checkout_create(checkout, agent=""):
    cid = (checkout or {}).get("cart_id")
    if cid:                                              # one active checkout per cart
        con = db(); rows = con.execute("SELECT data FROM ucp_sessions WHERE expires_at>?", (now_iso(),)).fetchall(); con.close()
        for r in rows:
            d = json.loads(r["data"])
            if d.get("_cart_id") == cid and d["status"] in ("incomplete", "requires_escalation"): return _out(d), 200
    d = chk_build("chk_" + uuid.uuid4().hex[:12], checkout); d["_agent"] = agent; _chk_save(d); return _out(d), 201
def core_checkout_get(sid):
    d = _chk_load(sid); return (_out(d), 200) if d else ucp_err("not_found", "No such checkout session.")
def core_checkout_update(sid, checkout, agent=""):
    prev = _chk_load(sid)
    if not prev: return ucp_err("not_found", "No such checkout session.")
    if prev["status"] in ("completed", "canceled"): return _public(prev), 200
    d = chk_build(sid, checkout, prev); d["_agent"] = agent or prev.get("_agent"); _chk_save(d); return _out(d), 200
def core_checkout_complete(sid, agent=""):
    """The platform asks to place the order. We never do that alone: the buyer must approve at continue_url."""
    d = _chk_load(sid)
    if not d: return ucp_err("not_found", "No such checkout session.")
    if d["status"] == "completed": return _public(d), 200
    if agent: d["_agent"] = agent
    _chk_save(d); return _out(d), 200
def core_checkout_cancel(sid):
    d = _chk_load(sid)
    if not d: return ucp_err("not_found", "No such checkout session.")
    if d["status"] != "completed": d["status"] = "canceled"; _chk_save(d)
    return _public(d), 200
def ucp_place_order(d, approved_by):
    """Called only from the approval page, by a signed-in person."""
    b = d["buyer"]; m = d["fulfillment"]["methods"][0]
    dest = next(x for x in m["destinations"] if x["id"] == m["selected_destination_id"])
    ship_to = ", ".join(v for v in (dest.get("street_address"), dest.get("extended_address"), dest.get("address_locality"),
                                    dest.get("address_region"), dest.get("postal_code"), dest.get("address_country")) if v)
    name = (b.get("first_name", "") + " " + b.get("last_name", "")).strip() or b["email"]
    agent = (d.get("_agent") or "AI agent")[:80]
    con = db(); ids = []
    for l in d["line_items"]:
        oid = "O_" + uuid.uuid4().hex[:10]; unit = l["item"]["price"] / 100
        total = round(unit * l["quantity"] + (SHIPPING_CENTS / 100 if not ids else 0), 2); ids.append(oid)
        con.execute("""INSERT INTO orders(id,product,product_name,qty,price_each,total,color,custom_text,buyer,status,created_at,
                                          visitor_name,visitor_email,buyer_email,source,ship_to,phone,agent)
                       VALUES(?,?,?,?,?,?,?,?,?,'ordered',?,?,?,?,'agent',?,?,?)""",
                    (oid, l["_slug"], SHOP_PRODUCTS[l["_slug"]]["name"], l["quantity"], unit, total, l["_colour"],
                     f"UCP {d['id']} · approved by {approved_by}", name, now_iso(), "", "", b["email"], ship_to, b.get("phone_number", ""), agent))
        add_print_job(con, oid, SHOP_PRODUCTS[l["_slug"]]["name"], l["quantity"], l["_colour"], "", name)
    con.commit(); con.close()
    d["status"] = "completed"; d["messages"] = [m for m in d["messages"] if m.get("code") != "buyer_approval_required"]
    d["order"] = {"id": ids[0], "label": "Order " + ids[0], "permalink_url": f"https://hardywu.com/order/{ids[0]}"}
    d["_order_ids"] = ids; d["_approved_by"] = approved_by; d["_approved_at"] = now_iso(); _chk_save(d)
    if d.get("_cart_id"):
        c = _cart_load(d["_cart_id"])
        if c: c["_status"] = "converted"; _cart_save(c)
    if mail_configured():
        send_mail(OWNER_EMAIL, f"New order via {agent}, approved by {approved_by}: {name}",
                  f"{name} <{b['email']}> {b.get('phone_number','')}\nShip to: {ship_to}\n\n" +
                  "\n".join(f"{l['quantity']} × {l['item']['title']}" for l in d["line_items"]) +
                  f"\n\nTotal ${d['totals'][-1]['amount']/100:.2f}. No payment taken — email the buyer.\nhttps://hardywu.com/orders")
    return d
def core_order(oid):
    con = db(); o = con.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone(); con.close()
    if not o: return ucp_err("not_found", "No such order.")
    o = dict(o)
    return {"ucp": ucp_env(["dev.ucp.shopping.order"]), "id": oid, "status": o["status"], "currency": "USD",
            "line_items": [{"id": "li_1", "item": {"id": ucp_variant_id(o["product"], o.get("color") or ""), "title": o.get("product_name"), "price": int(round(o["price_each"] * 100))},
                            "quantity": o["qty"], "totals": [{"type": "total", "amount": int(round(o["price_each"] * o["qty"] * 100))}]}],
            "totals": [{"type": "total", "amount": int(round(o["total"] * 100))}], "permalink_url": f"https://hardywu.com/order/{oid}"}, 200

# ---- REST binding
def _agent_hdr(): return (request.headers.get("UCP-Agent") or request.headers.get("User-Agent") or "")[:80]
def _J(pair): body, status = pair; return jsonify(body), status
@app.get("/.well-known/ucp")
def ucp_profile():
    spec = f"https://ucp.dev/{UCP_VERSION}"
    def cap(path, schema, extends=None):
        c = {"version": UCP_VERSION, "spec": f"{spec}/specification/{path}", "schema": f"{spec}/schemas/{schema}"}
        if extends: c["extends"] = extends
        return [c]
    return jsonify(ucp={
        "version": UCP_VERSION,
        "services": {"dev.ucp.shopping": [
            {"version": UCP_VERSION, "spec": f"{spec}/specification/overview/", "transport": "rest", "endpoint": ucp_public_base()[0],
             "schema": f"{spec}/services/shopping/rest.openapi.json"},
            {"version": UCP_VERSION, "spec": f"{spec}/specification/overview/", "transport": "mcp", "endpoint": ucp_public_base()[1],
             "schema": f"{spec}/services/shopping/mcp.openrpc.json"}]},
        "capabilities": {
            "dev.ucp.shopping.catalog.search": cap("shopping/catalog/search", "shopping/catalog_search.json"),
            "dev.ucp.shopping.catalog.lookup": cap("shopping/catalog/lookup", "shopping/catalog_lookup.json"),
            "dev.ucp.shopping.cart": cap("shopping/cart", "shopping/cart.json"),
            "dev.ucp.shopping.checkout": cap("shopping/checkout", "shopping/checkout.json"),
            "dev.ucp.shopping.fulfillment": cap("shopping/extensions/fulfillment", "shopping/fulfillment.json", "dev.ucp.shopping.checkout")},
        "payment_handlers": {}},
        business={"name": "Hardy Wu", "url": "https://hardywu.com", "contact": OWNER_EMAIL,
                  "note": "Carts are free to build. A checkout is only placed after the buyer approves it at continue_url; no card is taken online — Hardy emails the buyer to arrange payment."})
@app.post("/ucp/catalog/search")
def r_search(): return _J(core_search(request.get_json(silent=True)))
@app.post("/ucp/catalog/lookup")
def r_lookup(): return _J(core_lookup(request.get_json(silent=True)))
@app.post("/ucp/catalog/product")
def r_product(): return _J(core_product(request.get_json(silent=True)))
@app.post("/ucp/carts")
def r_cart_create():
    if not agent_rate_ok(request.remote_addr or "?", limit=60): return _J(ucp_err("rate_limited", "Too many carts from this address; try later.", 429))
    return _J(core_cart_create(request.get_json(silent=True)))
@app.get("/ucp/carts/<cid>")
def r_cart_get(cid): return _J(core_cart_get(cid))
@app.put("/ucp/carts/<cid>")
def r_cart_update(cid): return _J(core_cart_update(cid, request.get_json(silent=True)))
@app.post("/ucp/carts/<cid>/cancel")
def r_cart_cancel(cid): return _J(core_cart_cancel(cid))
@app.post("/ucp/checkout-sessions")
def r_chk_create():
    if not agent_rate_ok(request.remote_addr or "?", limit=30): return _J(ucp_err("rate_limited", "Too many checkouts from this address; try later.", 429))
    return _J(core_checkout_create(request.get_json(silent=True), _agent_hdr()))
@app.get("/ucp/checkout-sessions/<sid>")
def r_chk_get(sid): return _J(core_checkout_get(sid))
@app.put("/ucp/checkout-sessions/<sid>")
def r_chk_update(sid): return _J(core_checkout_update(sid, request.get_json(silent=True), _agent_hdr()))
@app.post("/ucp/checkout-sessions/<sid>/complete")
def r_chk_complete(sid): return _J(core_checkout_complete(sid, _agent_hdr()))
@app.post("/ucp/checkout-sessions/<sid>/cancel")
def r_chk_cancel(sid): return _J(core_checkout_cancel(sid))
@app.get("/ucp/orders/<oid>")
def r_order(oid): return _J(core_order(oid))

# ---- MCP binding: JSON-RPC 2.0 over HTTP (Streamable HTTP, JSON responses).
# UCP capabilities map 1:1 to tools; the same names also work as bare JSON-RPC methods.
MCP_TOOLS = [
  ("search_catalog", "Search Hardy's 3D-printed products by words and optional price filter (amounts in cents). Returns products with colour variants; use a variant id (e.g. crab-gauge__black) as line_items[].item.id.",
   {"type": "object", "properties": {"meta": {"type": "object"}, "catalog": {"type": "object", "properties": {"query": {"type": "string"}, "filters": {"type": "object"}}}}}),
  ("lookup_catalog", "Look up products by product or variant ids.", {"type": "object", "properties": {"meta": {"type": "object"}, "catalog": {"type": "object", "properties": {"ids": {"type": "array", "items": {"type": "string"}}}, "required": ["ids"]}}, "required": ["catalog"]}),
  ("get_product", "Full details of one product by id or handle.", {"type": "object", "properties": {"meta": {"type": "object"}, "catalog": {"type": "object", "properties": {"id": {"type": "string"}}}}}),
  ("create_cart", "Start a cart with line items [{item:{id:variant_id}, quantity}]. Free to change later.", {"type": "object", "properties": {"meta": {"type": "object"}, "cart": {"type": "object"}}, "required": ["cart"]}),
  ("get_cart", "Read a cart.", {"type": "object", "properties": {"meta": {"type": "object"}, "id": {"type": "string"}}, "required": ["id"]}),
  ("update_cart", "Replace the cart's line items with the full new list: add an item by including it, change a quantity, remove an item by leaving it out.", {"type": "object", "properties": {"meta": {"type": "object"}, "id": {"type": "string"}, "cart": {"type": "object"}}, "required": ["id", "cart"]}),
  ("cancel_cart", "Empty and cancel a cart.", {"type": "object", "properties": {"meta": {"type": "object"}, "id": {"type": "string"}}, "required": ["id"]}),
  ("create_checkout", "Turn a cart into a checkout (pass cart_id) or start one from line items. Add buyer {first_name,last_name,email,phone_number} and fulfillment.methods[0].destinations[0] (US postal address). The order is NOT placed until the buyer opens continue_url and presses Approve. Give the buyer continue_url.",
   {"type": "object", "properties": {"meta": {"type": "object"}, "checkout": {"type": "object"}}, "required": ["checkout"]}),
  ("get_checkout", "Read a checkout. While the buyer's approval is pending it returns continue_url for them; status becomes completed with order once they approve.", {"type": "object", "properties": {"meta": {"type": "object"}, "id": {"type": "string"}}, "required": ["id"]}),
  ("update_checkout", "Full replacement update of a checkout (buyer, line items, address).", {"type": "object", "properties": {"meta": {"type": "object"}, "id": {"type": "string"}, "checkout": {"type": "object"}}, "required": ["id", "checkout"]}),
  ("complete_checkout", "Ask to place the order. Hardy's shop answers requires_escalation: the buyer must approve at continue_url first.", {"type": "object", "properties": {"meta": {"type": "object"}, "id": {"type": "string"}, "checkout": {"type": "object"}}, "required": ["id"]}),
  ("cancel_checkout", "Cancel a checkout.", {"type": "object", "properties": {"meta": {"type": "object"}, "id": {"type": "string"}}, "required": ["id"]}),
  ("get_order", "Read a placed order by id.", {"type": "object", "properties": {"meta": {"type": "object"}, "id": {"type": "string"}}, "required": ["id"]}),
  ("search_shop_policies_and_faqs", "Answer questions about the shop: payment, shipping, returns, privacy, custom text and pictures, how AI assistants may order.",
   {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}),
]
def shop_faq():
    return [
      {"id": "payment", "title": "Payment", "body": "Nothing is charged online yet. When you order, Hardy emails you to arrange payment (pay on delivery). No card details are ever asked for on the site."},
      {"id": "shipping", "title": "Shipping and delivery", "body": f"Every piece is 3D-printed to order by Hardy and shipped within the US — {'shipping is free' if SHIPPING_CENTS == 0 else f'a flat ${SHIPPING_CENTS/100:.2f}'}. Printing plus shipping usually takes about a week."},
      {"id": "returns", "title": "Returns and refunds", "body": f"If something arrives broken or wrong, email {OWNER_EMAIL} and we reprint or refund. Custom pieces (your text or picture) cannot be returned for change of mind."},
      {"id": "customization", "title": "Colours, custom text and pictures", "body": "Every product comes in seven colours: " + ", ".join(SHOP_COLORS) + ". Some products take custom text (up to 30 letters) or your own picture; each extra is $2, and each extra colour is $2. Custom text and pictures are only available on the human store page, not through an assistant."},
      {"id": "ai", "title": "Ordering through an AI assistant", "body": "An assistant may search, build a cart and prepare a checkout for you, but nothing is ordered until you open the approval link yourself, sign in with your own email and press Approve."},
      {"id": "privacy", "title": "Privacy", "body": "We keep your name, email and address only to make and ship your order, and never share them."},
      {"id": "about", "title": "About the shop", "body": "Hardy Wu is a young maker. Hardy's 3D sells small 3D-printed pieces he designs and prints himself: a blue-crab measuring gauge, a dual-unit ruler, and a customizable lunchbox."},
    ]
def core_policies(query):
    q = [w for w in re.findall(r"[a-z]+", str(query or "").lower()) if len(w) > 2]
    scored = []
    for f in shop_faq():
        hay = (f["title"] + " " + f["body"]).lower()
        score = sum(hay.count(w) for w in q)
        if score or not q: scored.append((score, f))
    scored.sort(key=lambda x: -x[0])
    return {"results": [{"id": f["id"], "title": f["title"], "body": f["body"], "url": "https://hardywu.com/terms"} for _, f in scored[:4]]}, 200
def mcp_dispatch(name, a):
    a = a or {}; agent = str(((a.get("meta") or {}).get("ucp-agent") or {}).get("profile") or "MCP agent")[:80]
    f = {"search_catalog": lambda: core_search(a.get("catalog")), "lookup_catalog": lambda: core_lookup(a.get("catalog")),
         "get_product": lambda: core_product(a.get("catalog")),
         "create_cart": lambda: core_cart_create(a.get("cart")), "get_cart": lambda: core_cart_get(a.get("id")),
         "update_cart": lambda: core_cart_update(a.get("id"), a.get("cart")), "cancel_cart": lambda: core_cart_cancel(a.get("id")),
         "create_checkout": lambda: core_checkout_create(a.get("checkout"), agent), "get_checkout": lambda: core_checkout_get(a.get("id")),
         "update_checkout": lambda: core_checkout_update(a.get("id"), a.get("checkout"), agent),
         "complete_checkout": lambda: core_checkout_complete(a.get("id"), agent), "cancel_checkout": lambda: core_checkout_cancel(a.get("id")),
         "get_order": lambda: core_order(a.get("id")),
         "search_shop_policies_and_faqs": lambda: core_policies(a.get("query"))}.get(name)
    return f() if f else None
def _rpc_result(mid, result): return {"jsonrpc": "2.0", "id": mid, "result": result}
def _rpc_error(mid, code, msg): return {"jsonrpc": "2.0", "id": mid, "error": {"code": code, "message": msg}}
def mcp_handle(msg):
    if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0": return _rpc_error(None, -32600, "Invalid request")
    mid, method, params = msg.get("id"), msg.get("method"), msg.get("params") or {}
    if method == "initialize":
        return _rpc_result(mid, {"protocolVersion": params.get("protocolVersion") or "2025-06-18", "capabilities": {"tools": {"listChanged": False}},
                                 "serverInfo": {"name": "Hardy Wu shop (UCP)", "version": UCP_VERSION},
                                 "instructions": "Search the catalogue, build a cart, create a checkout with buyer + US address, then hand the buyer the continue_url. The buyer signs in and presses Approve; poll get_checkout until status is completed. No card is taken; Hardy emails the buyer."})
    if method in ("notifications/initialized", "notifications/cancelled"): return None
    if method == "ping": return _rpc_result(mid, {})
    if method == "tools/list":
        return _rpc_result(mid, {"tools": [{"name": n, "description": d, "inputSchema": s} for n, d, s in MCP_TOOLS]})
    if method == "tools/call":
        name = params.get("name"); out = mcp_dispatch(name, params.get("arguments"))
        if out is None: return _rpc_error(mid, -32602, f"Unknown tool {name!r}")
        body, status = out
        return _rpc_result(mid, {"content": [{"type": "text", "text": json.dumps(body)}], "structuredContent": body, "isError": status >= 400})
    out = mcp_dispatch(method, params)              # bare UCP method names (OpenRPC style)
    if out is not None: return _rpc_result(mid, out[0])
    return _rpc_error(mid, -32601, f"Method not found: {method}")
@app.route("/ucp/mcp", methods=["POST", "GET", "DELETE"])
def mcp_endpoint():
    if request.method != "POST":
        return jsonify(error="This MCP server answers JSON-RPC over POST only (no server-sent stream)."), 405
    if not agent_rate_ok(request.remote_addr or "?", limit=600): return jsonify(_rpc_error(None, -32000, "Too many requests")), 429
    msg = request.get_json(silent=True)
    if isinstance(msg, list):
        out = [r for r in (mcp_handle(m) for m in msg) if r is not None]
        return (jsonify(out), 200) if out else ("", 202)
    out = mcp_handle(msg)
    return (jsonify(out), 200) if out is not None else ("", 202)

# ---- the human approval page: the buyer (signed in on hardywu.com) reviews and approves
@app.route("/approve/<sid>", methods=["GET", "POST"])
def approve_page(sid):
    d = _chk_load(sid)
    if not d:
        return p_page("Approve order", "<header><h1>No such checkout</h1><p class=\"tag\">It may have expired. Ask your assistant to start again.</p></header>", '<a href="/">← hardywu.com</a>'), 404
    unlocked = set(session.get("approve_ok") or [])
    if request.args.get("code") and _code_valid(d, request.args.get("code")):
        unlocked.add(sid); session["approve_ok"] = sorted(unlocked)[-20:]; session.permanent = True
        if not visitor():                                   # sign in first; the unlock survives in the cookie
            return redirect((login_url_for("") if on_real_site() else "/") + "?next=/approve/" + sid)
        return redirect("/approve/" + sid)                  # drop the code from the address bar
    if sid not in unlocked:                                 # no fresh code and never unlocked here: show nothing at all
        return p_page("Approve order", f"""<header><h1>This link has expired</h1>
          <p class="tag">Approval links are private to one checkout and stop working when it expires.<br>Ask your assistant for a fresh link.</p></header>""",
          '<a href="/">← hardywu.com</a>'), 403
    me = visitor() or ""
    buyer_email = (d.get("buyer") or {}).get("email", "").lower()
    allowed = bool(me) and (not buyer_email or me == buyer_email or is_owner() or is_hardy())
    lines = "".join(f"<li><b>{l['quantity']} × {html.escape(l['item']['title'])}</b> — ${l['totals'][0]['amount']/100:.2f}</li>" for l in d["line_items"])
    m = d["fulfillment"]["methods"][0]; dest = next((x for x in m["destinations"] if x["id"] == m["selected_destination_id"]), {})
    addr = ", ".join(v for v in (dest.get("street_address"), dest.get("extended_address"), dest.get("address_locality"), dest.get("address_region"), dest.get("postal_code"), dest.get("address_country")) if v)
    total = d["totals"][-1]["amount"] / 100
    if request.method == "POST" and me and d["status"] in ("incomplete", "requires_escalation"):
        if request.form.get("decision") == "approve":
            f = request.form; b0 = d.get("buyer") or {}
            m0 = d["fulfillment"]["methods"][0]; d0 = next((x for x in m0["destinations"] if x["id"] == m0.get("selected_destination_id")), {})
            pick = lambda name, old: (f.get(name) or "").strip() or (old or "")   # what the buyer typed wins; blanks keep the assistant's values
            req = {"line_items": [{"id": l["id"], "item": {"id": l["item"]["id"]}, "quantity": l["quantity"]} for l in d["line_items"]],
                   "buyer": {"first_name": pick("first_name", b0.get("first_name")), "last_name": pick("last_name", b0.get("last_name")),
                             "email": me, "phone_number": pick("phone", b0.get("phone_number"))},
                   "fulfillment": {"methods": [{"type": "shipping", "selected_destination_id": "dest_1", "destinations": [{
                       "id": "dest_1", "street_address": pick("street", d0.get("street_address")), "extended_address": pick("street2", d0.get("extended_address")),
                       "address_locality": pick("city", d0.get("address_locality")), "address_region": pick("region", d0.get("address_region")),
                       "postal_code": pick("postal", d0.get("postal_code")), "address_country": "US"}]}]}}
            d = chk_build(sid, req, d); d["_agent"] = d.get("_agent"); _chk_save(d)
            buyer_email = me; allowed = True
            if d["status"] == "requires_escalation":
                d = ucp_place_order(d, me)
        else:
            d["status"] = "canceled"; _chk_save(d)
    if d["status"] == "completed":
        body = f"""<header><h1>Approved ✓</h1><p class="tag">Order <b>{html.escape(d['order']['id'])}</b> is placed. Hardy will email <b>{html.escape(buyer_email)}</b> to arrange payment and shipping.</p>
          <p class="tag"><a href="{d['order']['permalink_url']}">See the order</a></p></header>"""
    elif d["status"] == "canceled":
        body = "<header><h1>Cancelled</h1><p class=\"tag\">Nothing was ordered.</p></header>"
    elif d["status"] == "incomplete" and not d["line_items"]:
        body = "<header><h1>Nothing to order</h1><p class=\"tag\">The cart is empty.</p></header>"
    else:
        from urllib.parse import urlparse as _up
        _ag = d.get("_agent") or ""
        agent = "Your AI assistant" + (f" ({html.escape(_up(_ag).hostname or _ag[:40])})" if _ag else "")
        summary = f"""<header><h1>Approve this order?</h1>
          <p class="tag">{agent} prepared it{(" for <b>" + html.escape(buyer_email) + "</b>") if buyer_email else ""}. Nothing is ordered and nothing is charged until you press Approve.</p></header>
          <div style="max-width:560px;margin:0 auto;text-align:left;background:rgba(9,28,66,.55);border:1px solid rgba(96,165,250,.28);border-radius:18px;padding:20px">
          <ul style="margin:0 0 10px 18px;line-height:1.8">{lines}</ul>
          <p style="margin:6px 0">Shipping: ${SHIPPING_CENTS/100:.2f} &nbsp;·&nbsp; <b>Total ${total:.2f}</b></p>
          <p style="margin:6px 0">Ship to: {html.escape(addr) or '<i>missing</i>'}</p>
          <p style="margin:6px 0;color:rgba(255,255,255,.65);font-size:13px">No card is charged online. Hardy emails you to arrange payment (pay on delivery).</p>"""
        if allowed or (me and not buyer_email):
            b = d.get("buyer") or {}; nm = (session.get("v_name") or "").split(" ", 1)
            probs = [x["content"] for x in d["messages"] if x["type"] == "error" and x.get("severity") == "recoverable"]
            I = lambda name, label, val, w="100%": f'<label style="display:block;font-size:13px;color:rgba(255,255,255,.7);margin-top:8px;width:{w}">{label}<br><input name="{name}" value="{html.escape(val or "")}" style="width:100%;box-sizing:border-box;font-size:16px;padding:9px;border-radius:9px;border:1px solid #3a4560;background:#0b1a3a;color:#fff"></label>'
            body = summary + f"""<form method="post" style="margin-top:14px">
              <p style="margin:0;font-weight:700">Your details {'' if not probs else '<span style="color:#fca5a5;font-weight:400;font-size:13px">— please fill in: ' + html.escape('; '.join(probs)) + '</span>'}</p>
              <div style="display:flex;gap:10px">{I("first_name","First name",b.get("first_name") or nm[0],"50%")}{I("last_name","Last name",b.get("last_name") or (nm[1] if len(nm)>1 else ""),"50%")}</div>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,.7)">Email: <b>{html.escape(me)}</b> (your sign-in)</p>
              {I("phone","Phone (optional)",b.get("phone_number"))}
              {I("street","Street address",dest.get("street_address"))}{I("street2","Apartment, unit (optional)",dest.get("extended_address"))}
              <div style="display:flex;gap:10px">{I("city","City",dest.get("address_locality"),"50%")}{I("region","State",dest.get("address_region"),"25%")}{I("postal","ZIP",dest.get("postal_code"),"25%")}</div>
              <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,.55)">US addresses only for now.</p>
              <div style="display:flex;gap:12px;margin-top:14px;flex-wrap:wrap">
              <button name="decision" value="approve" style="font-weight:800;font-size:18px;padding:12px 28px;border:0;border-radius:12px;background:#22c55e;color:#04210f;cursor:pointer">✓ Approve and order</button>
              <button name="decision" value="cancel" style="font-weight:700;font-size:16px;padding:12px 22px;border:1px solid rgba(255,255,255,.4);border-radius:12px;background:transparent;color:#fff;cursor:pointer">Cancel</button></div></form></div>"""
        elif me:
            body = summary + f"""<p style="margin-top:14px;color:#fca5a5">You are signed in as <b>{html.escape(me)}</b>, but this order is for <b>{html.escape(buyer_email)}</b>. <a href="/signout" style="color:#fff">Sign out</a> and sign in with that email to approve it.</p></div>"""
        else:
            body = summary + f"""<p style="margin-top:14px"><a href="{login_url_for('') if on_real_site() else '/'}?next=/approve/{html.escape(sid)}" style="color:#fff;font-weight:700">Sign in as {html.escape(buyer_email)} to approve →</a></p></div>"""
    return p_page("Approve order — Hardy Wu", body, '<a href="/">← hardywu.com</a>')

@app.get("/order/<oid>")
def order_permalink(oid):
    con = db(); o = con.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone(); con.close()
    if not o: return p_page("Order", "<header><h1>No such order</h1></header>", '<a href="/">← hardywu.com</a>'), 404
    o = dict(o)
    return p_page(f"Order {oid}", f"""<header><h1>Order {html.escape(oid)}</h1>
      <p class="tag">{o['qty']} × {html.escape(o.get('product_name') or '')}{(' · ' + html.escape(o['color'])) if o.get('color') else ''} · ${o['total']:.2f}</p>
      <p class="tag">Status: <b>{html.escape(o['status'])}</b>{' · booked' if o.get('booked') else ''}</p>
      <p class="tag">Hardy prints it to order. Payment is arranged by email — no card was charged online. Questions: {html.escape(OWNER_EMAIL)}</p></header>""",
      '<a href="/">← hardywu.com</a>')

@app.get("/terms")
def terms_page():
    return p_page("Terms", f"""<header><h1>Terms, shipping &amp; returns</h1>
      <p class="tag"><b>Payment.</b> Nothing is charged online yet. When you order, Hardy emails you to arrange payment (pay on delivery).</p>
      <p class="tag"><b>Shipping.</b> Everything is 3D-printed to order and shipped within the US for a flat ${SHIPPING_CENTS/100:.2f}.</p>
      <p class="tag"><b>AI assistants.</b> An assistant may build a cart and prepare a checkout for you, but nothing is ordered until you approve it yourself on hardywu.com.</p>
      <p class="tag"><b>Returns.</b> If something arrives broken or wrong, email {html.escape(OWNER_EMAIL)} and we will reprint or refund.</p>
      <p class="tag"><b>Privacy.</b> We keep your name, email and address only to make and ship your order, and never share them.</p></header>""",
      '<a href="/">← hardywu.com</a>')

@app.post("/api/order/from-shop")
def order_from_shop():
    if not is_local_request():
        return jsonify(error="Internal only."), 403
    x = request.get_json(force=True)
    ref = str(x.get("ref") or "")[:120]   # Stripe session id + line: a retried payment webhook must not record the order twice
    if ref:
        con = db()
        con.execute("CREATE TABLE IF NOT EXISTS shop_refs(ref TEXT PRIMARY KEY, order_id TEXT NOT NULL)")
        row = con.execute("SELECT order_id FROM shop_refs WHERE ref=?", (ref,)).fetchone()
        con.close()
        if row:
            return jsonify(ok=True, order=row[0], duplicate=True)
    oid = "O_" + uuid.uuid4().hex[:10]
    # the store forwards the shopper's cookie, so we know who was signed in; a paid card order
    # comes from Stripe's webhook instead, with the signed-in email the store saw at checkout
    v_name, v_email = (session.get("v_name") or "").strip(), (visitor() or str(x.get("account") or "").strip().lower()[:90])
    buyer = str(x.get("buyer") or "").strip()[:60]
    if not buyer or buyer == "Online customer":
        buyer = v_name or "Online customer"
    pname, qty = str(x.get("product_name") or x.get("product") or "")[:80], int(x.get("qty") or 1)
    color, details = str(x.get("color") or "")[:60], str(x.get("details") or "")[:300]
    ship_to, phone = str(x.get("ship_to") or "").strip()[:300], str(x.get("phone") or "").strip()[:40]
    con = db()
    con.execute("""INSERT INTO orders(id,product,product_name,qty,price_each,total,color,custom_text,buyer,status,created_at,
                                      visitor_name,visitor_email,buyer_email,source,ship_to,phone)
                   VALUES(?,?,?,?,?,?,?,?,?,'ordered',?,?,?,?,'shop',?,?)""",
                (oid, str(x.get("product") or "")[:60], pname, qty, float(x.get("price_each") or 0), float(x.get("total") or 0),
                 color, details, buyer, now_iso(), v_name, v_email, str(x.get("email") or "").strip()[:90] or v_email, ship_to, phone))
    add_print_job(con, oid, pname, qty, color, details, buyer)
    if ref:
        con.execute("INSERT INTO shop_refs(ref, order_id) VALUES(?,?)", (ref, oid))
    con.commit(); con.close()
    return jsonify(ok=True, order=oid, signed_in=v_email or None)

@app.get("/costs")
def cost_sheet():
    """Hardy's cost sheet: material, electricity, labour, design, postage and packaging per product, and the margin at the current price."""
    if not is_owner():
        return redirect(APP_HOST + "/costs") if not on_real_site() else ("Only the creator can see costs.", 403)
    cat = json.loads((SHOP_DIR / "data" / "catalog.json").read_text())
    k = cat.get("costing") or {}
    rows = []
    for p in cat["products"]:
        c = p.get("cost") or {}
        material = c.get("grams", 0) / 1000 * k.get("filamentPerKg", 22)
        elec = c.get("printHours", 0) * k.get("printerWatts", 120) / 1000 * k.get("electricityPerKwh", 0.17)
        labor = c.get("laborHours", 0) * k.get("laborPerHour", 15)
        design = c.get("designHours", 0) * k.get("designPerHour", 20) / max(1, k.get("designUnits", 40))
        total = material + elec + labor + design + c.get("shipping", 0) + c.get("packaging", 0)
        price = float(p["price"]); margin = (price - total) / price if price else 0
        rows.append((p["name"] + (" ✎" if p.get("priceSetBy") else ""), c, material, elec, labor, design, total, total / (1 - k.get("minMargin", .3)), price, margin, p.get("market", "")))
    ad = cat.get("addons") or {}
    html = ["<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Costs — Hardy's 3D</title>",
            "<style>body{font-family:-apple-system,Inter,sans-serif;background:#03102c;color:#fff;padding:20px;max-width:1100px;margin:0 auto}table{border-collapse:collapse;width:100%;font-size:14px;margin:14px 0}td,th{padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.15);text-align:right}th:first-child,td:first-child{text-align:left}th{color:#9fd1ff;font-weight:600}.ok{color:#5fd38a;font-weight:700}.bad{color:#ff6b6b;font-weight:700}.sm{color:rgba(255,255,255,.65);font-size:13px}a{color:#9fe3ff}</style>",
            "<h1>What each piece costs</h1><p class=sm>Shipping is free for the buyer, so postage is part of the cost. Price must leave at least " + f"{k.get('minMargin', .3):.0%}" + " gross margin. Numbers are estimates in company/site/shop/data/catalog.json — tell Claude to change any of them.</p>",
            "<table><tr><th>Product</th><th>Filament</th><th>Print</th><th>Material</th><th>Electricity</th><th>Labour</th><th>Design</th><th>Postage</th><th>Packaging</th><th>Cost</th><th>Min price</th><th>Price</th><th>Margin</th><th style='text-align:left'>What competitors charge</th></tr>"]
    for name, c, m, e, l, d, t, mn, pr, mg, mk in rows:
        cls = "ok" if mg >= k.get("minMargin", .3) - 1e-9 else "bad"
        html.append(f"<tr><td>{name}</td><td>{c.get('grams',0)} g</td><td>{c.get('printHours',0)} h</td><td>${m:.2f}</td><td>${e:.2f}</td><td>${l:.2f} <span class=sm>({c.get('laborHours',0)} h)</span></td><td>${d:.2f} <span class=sm>({c.get('designHours',0)} h ÷ {k.get('designUnits',40)})</span></td><td>${c.get('shipping',0):.2f}</td><td>${c.get('packaging',0):.2f}</td><td><b>${t:.2f}</b></td><td>${mn:.2f}</td><td><b>${pr:.2f}</b></td><td class={cls}>{mg:.0%}</td><td class=sm style='text-align:left'>{mk}</td></tr>")
    html.append("</table><h2>Rates</h2><table>" + "".join(f"<tr><td>{kk}</td><td>{vv}</td></tr>" for kk, vv in k.items() if kk != "note") + "</table>")
    ac = cat.get("addonCost") or {}
    html.append("<h2>Add-ons</h2><table><tr><th>Add-on</th><th>What it takes</th><th>Cost</th><th>Price</th><th>Margin</th></tr>" + "".join(
        f"<tr><td>{({'text':'Name','image':'Picture','extraColor':'Each extra colour'}).get(key,key)}</td><td>{a.get('why','')}</td><td>${a.get('cost',0):.2f}</td><td>${ad.get(key,0):.2f}</td><td class=ok>{(ad.get(key,0)-a.get('cost',0))/ad.get(key,1):.0%}</td></tr>" for key, a in ac.items()) + "</table>")
    html.append(f"<p class=sm>Prices marked ✎ were set by Hardy and may be below the {k.get('minMargin', .3):.0%} target. {k.get('note','')}</p><p><a href='/orders'>← orders</a></p>")
    return "\n".join(html)

@app.get("/api/orders/mine")
def my_orders():
    """The signed-in shopper's own orders (the store's 'Your Orders' page)."""
    em = visitor()
    if not em:
        return jsonify(error="Please sign in."), 401
    con = db()
    rows = [dict(r) for r in con.execute("""SELECT id,product,product_name,qty,price_each,total,color,custom_text,status,created_at,ship_to,source
                                             FROM orders WHERE lower(visitor_email)=? OR lower(buyer_email)=? ORDER BY created_at DESC LIMIT 200""", (em, em))]
    jobs = {j["order_id"]: dict(j) for j in con.execute("SELECT order_id,status FROM print_jobs")}
    con.close()
    for o in rows:
        o["print_status"] = (jobs.get(o["id"]) or {}).get("status")
    return jsonify(orders=rows, email=em, name=session.get("v_name") or "")

def _reviews_table(con):
    con.execute("""CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY, product TEXT NOT NULL, name TEXT, email TEXT NOT NULL,
                   stars INTEGER NOT NULL, title TEXT, body TEXT, created_at TEXT NOT NULL, UNIQUE(product, email))""")

@app.get("/api/reviews/<slug>")
def get_reviews(slug):
    con = db(); _reviews_table(con)
    rows = [dict(r) for r in con.execute("SELECT id,product,name,stars,title,body,created_at FROM reviews WHERE product=? ORDER BY created_at DESC", (slug[:60],))]
    con.close()
    avg = round(sum(r["stars"] for r in rows) / len(rows), 1) if rows else None
    return jsonify(reviews=rows, count=len(rows), average=avg)

@app.post("/api/reviews/<slug>")
def post_review(slug):
    """One review per signed-in shopper per product; writing again replaces it."""
    em = visitor()
    if not em:
        return jsonify(error="Please sign in to write a review."), 401
    x = request.get_json(force=True) or {}
    stars = int(x.get("stars") or 0)
    if stars < 1 or stars > 5:
        return jsonify(error="Pick 1 to 5 stars."), 400
    body = str(x.get("body") or "").strip()[:1000]
    title = str(x.get("title") or "").strip()[:80]
    con = db(); _reviews_table(con)
    con.execute("INSERT OR REPLACE INTO reviews(id,product,name,email,stars,title,body,created_at) VALUES(?,?,?,?,?,?,?,?)",
                ("R_" + uuid.uuid4().hex[:10], slug[:60], (session.get("v_name") or "")[:60], em, stars, title, body, now_iso()))
    con.commit(); con.close()
    return jsonify(ok=True)

@app.get("/api/orders")
def list_orders():
    if not is_owner():
        return jsonify(error="Only the creator can see orders."), 403
    con = db()
    if request.args.get("all"):        # the Orders tab: every order ever placed, newest first
        rows = [dict(r) for r in con.execute("SELECT * FROM orders ORDER BY created_at DESC")]
    else:                              # the dashboard box: only what still needs booking
        rows = [dict(r) for r in con.execute("""SELECT * FROM orders WHERE booked=0
                                                 AND status NOT IN ('cancelled','returned') ORDER BY created_at""")]
    jobs = {j["order_id"]: dict(j) for j in con.execute("SELECT * FROM print_jobs")}
    con.close()
    for o in rows:
        o["print_status"] = (jobs.get(o["id"]) or {}).get("status")
    return jsonify(orders=rows)

@app.post("/api/orders/update")
def update_order():
    """Move an order along (ordered → printed → shipped → returned / cancelled) or tick it as booked."""
    if not is_owner():
        return jsonify(error="Only the creator can update orders."), 403
    x = request.get_json(force=True)
    oid = str(x.get("id") or "")
    status = str(x.get("status") or "")
    if status and status not in ORDER_STATUSES:
        return jsonify(error="Status must be one of: " + ", ".join(ORDER_STATUSES) + "."), 400
    con = db()
    if not con.execute("SELECT 1 FROM orders WHERE id=?", (oid,)).fetchone():
        con.close(); return jsonify(error="No such order."), 404
    if "booked" in x:
        con.execute("UPDATE orders SET booked=? WHERE id=?", (1 if x.get("booked") else 0, oid))
    if status:
        con.execute("UPDATE orders SET status=? WHERE id=?", (status, oid))
        # keep the printer queue in step with the order
        if status in ("printed", "shipped", "returned"):
            con.execute("UPDATE print_jobs SET status='done', done_at=COALESCE(done_at,?) WHERE order_id=? AND status!='done'",
                        (now_iso(), oid))
        elif status == "ordered":
            con.execute("UPDATE print_jobs SET status='todo', done_at=NULL WHERE order_id=?", (oid,))
            if not con.execute("SELECT 1 FROM print_jobs WHERE order_id=?", (oid,)).fetchone():
                o = dict(con.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone())
                add_print_job(con, oid, o.get("product_name") or o["product"], o["qty"], o.get("color") or "",
                              o.get("custom_text") or "", o.get("buyer") or "")
        elif status == "cancelled":
            con.execute("DELETE FROM print_jobs WHERE order_id=? AND status!='done'", (oid,))
    con.commit(); con.close()
    return jsonify(ok=True)

@app.get("/api/print-jobs")
def list_print_jobs():
    """The 3D-printer queue: one task per order, oldest first; finished ones last."""
    if not is_owner():
        return jsonify(error="Only the creator can see the print queue."), 403
    con = db()
    rows = [dict(r) for r in con.execute("""SELECT j.*, o.status AS order_status, o.total, o.buyer_email, o.source
                                           FROM print_jobs j LEFT JOIN orders o ON o.id=j.order_id
                                           ORDER BY (j.status='done'), j.created_at""")]
    con.close()
    return jsonify(jobs=rows, todo=sum(1 for r in rows if r["status"] != "done"))

@app.post("/api/print-jobs/update")
def update_print_job():
    if not is_owner():
        return jsonify(error="Only the creator can update the print queue."), 403
    x = request.get_json(force=True)
    jid, status = str(x.get("id") or ""), str(x.get("status") or "")
    if status not in JOB_STATUSES:
        return jsonify(error="Status must be one of: " + ", ".join(JOB_STATUSES) + "."), 400
    con = db()
    job = con.execute("SELECT * FROM print_jobs WHERE id=?", (jid,)).fetchone()
    if not job:
        con.close(); return jsonify(error="No such print job."), 404
    now = now_iso()
    con.execute("UPDATE print_jobs SET status=?, started_at=CASE WHEN ?='printing' THEN COALESCE(started_at,?) ELSE started_at END, "
                "done_at=CASE WHEN ?='done' THEN ? ELSE NULL END WHERE id=?", (status, status, now, status, now, jid))
    # a finished print moves its order to "printed" (and re-opening one moves it back)
    if status == "done":
        con.execute("UPDATE orders SET status='printed' WHERE id=? AND status='ordered'", (job["order_id"],))
    else:
        con.execute("UPDATE orders SET status='ordered' WHERE id=? AND status='printed'", (job["order_id"],))
    con.commit(); con.close()
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
    if p == "/feedback": return "Feedback"
    if p == "/orders":
        return "Orders"
    if p == "/activity":
        return "Activity report"
    if p.startswith("/play/"):
        slug = p.split("/play/")[1].strip("/")
        return {"nova": "Playing Nova Blast", "quest": "Playing Critter Quest",
                "fifa": "Playing Football Sim", "zsy": "Playing 争上游", "latin": "Playing Elemental Latin", "elementum": "Playing Elementum", "news": "Reading the news"}.get(slug.split("/")[0], "Playing " + slug)
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

from zoneinfo import ZoneInfo
HOME_TZ = ZoneInfo("America/New_York")
def now_local():
    return datetime.datetime.now(HOME_TZ).isoformat(timespec="seconds")
def when_local(iso):
    """A stored timestamp → aware datetime in Hardy's time zone (old entries were naive local time)."""
    try:
        d = datetime.datetime.fromisoformat(iso)
    except Exception:
        return None
    return d.replace(tzinfo=HOME_TZ) if d.tzinfo is None else d.astimezone(HOME_TZ)
def fmt_when(iso):
    d = when_local(iso)
    if not d: return ""
    today = datetime.datetime.now(HOME_TZ).date()
    day = "today" if d.date() == today else "yesterday" if d.date() == today - datetime.timedelta(days=1) \
          else d.strftime("%b %-d, %Y")
    return f'{day} · {d.strftime("%-I:%M %p").lower()}'
def month_key(iso):
    d = when_local(iso); return d.strftime("%Y-%m") if d else ""

# games still being built are not on the activity page (Barbara: "no more Playing elementum")
UNTRACKED_PREFIXES = ("/play/elementum", "/games/elementum")

def track(kind, label, path, seconds=0, detail=""):
    em = visitor()
    if not em or (path or "").startswith(UNTRACKED_PREFIXES):
        return
    with _act_lock:
        data = _act_load()
        who = data["people"].setdefault(em, {
            "name": session.get("v_name") or "", "email": em,
            "first_seen": now_iso(), "last_seen": now_iso(),
            "total_seconds": 0, "activities": {}, "clicks": [], "visits": 0})
        who["name"] = session.get("v_name") or who.get("name") or ""
        who["last_seen"] = now_local()
        day = who.setdefault("days", {}).setdefault(now_local()[:10], {"opens": 0, "seconds": 0})
        if kind in ("view", "open"): day["opens"] += 1
        if seconds: day["seconds"] += max(0, min(120, int(seconds)))
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
        if kind in ("click", "open"):
            who["clicks"].append({"at": now_local(), "what": detail or (f"opened {label}" if kind == "open" else label),
                                  "where": friendly_label(path), "path": path})
            who["clicks"] = who["clicks"][-400:]           # keep the most recent trail
        _act_save(data)

VISITOR_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>Welcome — hardywu.com</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="/favicon.png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:#e6ddcf}
body{font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#2f2a24;
 display:grid;place-items:center;padding:28px;text-align:center;
 background:radial-gradient(1100px 600px at 50% -10%,#efe6d7 0%,rgba(239,230,215,0) 60%),
  linear-gradient(180deg,#e9e1d4 0%,#e3d9c9 100%);background-attachment:fixed}
.card{width:min(460px,100%);background:#f3ede3;border:1px solid #d2c4ae;
 border-radius:22px;padding:32px 26px;box-shadow:0 14px 40px rgba(90,65,40,.14)}
img.logo{width:92px;height:92px;border-radius:20px}
h1{font-size:clamp(30px,7vw,46px);font-weight:900;font-style:italic;text-transform:uppercase;
 letter-spacing:-.045em;line-height:.95;margin:16px 0 6px}
p{color:#6b6157;font-size:15px;line-height:1.55;margin:8px 0}
input{font:inherit;font-size:17px;padding:15px 16px;border-radius:14px;border:1px solid #d2c4ae;
 background:#faf6ef;color:#2f2a24;width:100%;margin:9px 0;text-align:center}
input:focus{outline:none;border-color:#b9603b}
button{font:inherit;font-weight:800;font-size:19px;padding:15px 30px;margin-top:14px;border:0;border-radius:14px;
 width:100%;cursor:pointer;background:#b9603b;color:#fff;
 box-shadow:0 8px 22px rgba(185,96,59,.3)}
.err{color:#b23b3b;min-height:20px;font-size:14px;font-weight:700;margin-top:8px}
.small{color:#6b6157;font-size:12.5px;margin-top:16px}
.devrow{margin:6px 0 4px;font-size:14px;color:#6b6157}.dev{font-size:14px;padding:8px 14px;margin:0 3px;border-radius:10px;border:1px solid #d2c4ae;background:#faf6ef;color:#2f2a24;cursor:pointer;opacity:.7;width:auto;box-shadow:none;font-weight:600}.dev.on{opacity:1;border-color:#b9603b;box-shadow:0 0 0 2px rgba(185,96,59,.25)}
</style></head><body>
<div class="card">
 <img class="logo" src="/logo.png" alt="Hardy Wu">
 <h1>Try New<br>Things.</h1>
 <p>Welcome to <b>hardywu.com</b> — apps, video games, 3D prints and robots.<br>Tell us who you are to come in.</p>
 <input id="nm" autofocus placeholder="Your name" autocomplete="name" maxlength="60">
 <input id="em" type="email" placeholder="Your email" autocomplete="email" maxlength="90">
 <div class="devrow" id="devrow">Playing on &nbsp;<button type="button" class="dev" data-dev="phone" onclick="pickDev('phone')">📱 Phone</button><button type="button" class="dev" data-dev="computer" onclick="pickDev('computer')">💻 Computer</button></div>
 <div class="err" id="err"></div>
 <button onclick="go()">Enter the site →</button>
 <p class="small">We email you a 6-digit code to check it's really you, and keep your name and email so Hardy knows who visited. Nothing is shared with anyone else.</p>
</div>
<script>
let device=(document.cookie.match(/(?:^|; )hw_device=(phone|computer)/)||[])[1]||((matchMedia("(pointer:coarse)").matches||navigator.maxTouchPoints>0)?"phone":"computer");
function pickDev(v){device=v;for(const b of document.querySelectorAll(".dev"))b.classList.toggle("on",b.dataset.dev===v);}
pickDev(device);
async function go(){
  const r=await fetch("/api/visitor",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name:nm.value,email:em.value,device,next:location.pathname+location.search})});
  const j=await r.json().catch(()=>({}));
  if(r.ok){if(j.verify)return showCode(j);location.href=j.next||"/";}else{err.textContent=j.error||"Please fill in both.";}
}
for(const el of [nm,em])el.addEventListener("keydown",e=>{if(e.key==="Enter")go();});
function showCode(j){
  const card=document.querySelector(".card");
  card.innerHTML=`<h1>Check your email</h1><p>We sent a 6-digit code to <b>${j.email}</b>.<br>Type it in within <b>30 seconds</b> to come in.</p>
   <input id="cd" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="6-digit code" autocomplete="one-time-code" autofocus>
   <div class="err" id="err2"></div><button onclick="verify()">Continue →</button>
   <p class="small"><a href="#" onclick="resend();return false" style="color:inherit">Send a new code</a> &nbsp;·&nbsp; <a href="" style="color:inherit">Wrong email? Start over</a></p>`;
  document.getElementById("cd").addEventListener("keydown",e=>{if(e.key==="Enter")verify();});
}
async function verify(){
  const r=await fetch("/api/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:document.getElementById("cd").value})});
  const j=await r.json().catch(()=>({}));
  if(r.ok){location.href=j.next||"/";}else{document.getElementById("err2").textContent=j.error||"That code didn't work.";}
}
async function resend(){
  const r=await fetch("/api/verify/resend",{method:"POST"});const j=await r.json().catch(()=>({}));
  document.getElementById("err2").textContent=r.ok?"A new code is on its way.":(j.error||"Could not send a new code.");
}
</script></body></html>"""

# ---- Email verification at sign-in ------------------------------------------
# Typing a name and email is not proof of who you are, so a 6-digit code is
# emailed and must be typed back before the sign-in counts. Codes are sent with
# a Gmail app password (MAIL_USER / MAIL_PASSWORD in .env) or Resend
# (RESEND_API_KEY). With neither configured the code step is skipped on the
# real site (nobody would receive it) — except from this Mac, where the code is
# handed back in the API reply so the flow can be tested.
MAIL_USER = os.environ.get("MAIL_USER", "").strip()
MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "").strip().replace(" ", "")
MAIL_FROM = os.environ.get("MAIL_FROM", "").strip() or (f"Hardy Wu <{MAIL_USER}>" if MAIL_USER else "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
VERIFY_SECONDS, VERIFY_TRIES = 30, 5      # the emailed code dies after 30 seconds (Barbara, 2026-09-26)

def mail_configured():
    return bool((MAIL_USER and MAIL_PASSWORD) or RESEND_API_KEY)

def send_mail(to, subject, text):
    """Send one plain-text email; runs in a thread so the request never waits on Gmail."""
    def _go():
        try:
            if MAIL_USER and MAIL_PASSWORD:
                import smtplib
                from email.message import EmailMessage
                m = EmailMessage(); m["From"], m["To"], m["Subject"] = MAIL_FROM, to, subject; m.set_content(text)
                with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20) as srv:
                    srv.login(MAIL_USER, MAIL_PASSWORD); srv.send_message(m)
            elif RESEND_API_KEY:
                import urllib.request
                body = json.dumps({"from": MAIL_FROM or "Hardy Wu <onboarding@resend.dev>", "to": [to],
                                   "subject": subject, "text": text}).encode()
                req = urllib.request.Request("https://api.resend.com/emails", data=body, method="POST",
                                             headers={"Authorization": "Bearer " + RESEND_API_KEY,
                                                      "Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=20).read()
        except Exception as e:                                       # noqa: BLE001
            print(f"[mail] could not send to {to}: {e}", flush=True)
    threading.Thread(target=_go, daemon=True).start()

def _from_this_mac():
    return request.remote_addr in ("127.0.0.1", "::1", None)

def _code_hash(code):
    import hmac
    key = app.secret_key if isinstance(app.secret_key, bytes) else str(app.secret_key).encode()
    return hmac.new(key, code.encode(), hashlib.sha256).hexdigest()

def login_needs_code(email):
    if os.environ.get("LOGIN_VERIFY", "").lower() == "off":
        return False
    if email in (session.get("trusted") or []):                       # already proved on this browser
        return False
    return mail_configured() or _from_this_mac()

def start_verification(name, email, flow, nxt):
    """Remember who is trying to sign in, email them a code, and tell the page to ask for it."""
    import secrets, time
    code = f"{secrets.randbelow(10**6):06d}"
    session.permanent = True
    session.update(pv_name=name, pv_email=email, pv_flow=flow, pv_next=nxt,
                   pv_hash=_code_hash(code), pv_exp=time.time() + VERIFY_SECONDS, pv_tries=0)
    if mail_configured():
        send_mail(email, f"{code} is your hardywu.com sign-in code",
                  f"Hi {name},\n\nYour sign-in code for hardywu.com is:\n\n    {code}\n\n"
                  f"It works for {VERIFY_SECONDS} seconds — type it in straight away (there is a 'Send a new code' link if it runs out). "
                  f"If you didn't ask for it, just ignore this email.\n\n— Hardy Wu")
    out = {"ok": True, "verify": True, "email": email}
    if not mail_configured() and _from_this_mac():
        out["code"] = code                                             # test hook, this Mac only
    return out

def remember_device(x):
    d = str(x.get("device") or "").strip().lower()
    if d in ("phone", "computer"):
        session["device"] = d

def with_device(payload):
    """Turn a JSON reply into a response that also sets the hw_device cookie (phone / computer)."""
    resp = jsonify(payload)
    d = session.get("device")
    if d in ("phone", "computer"):
        h = (request.host or "").split(":")[0].lower()
        resp.set_cookie("hw_device", d, max_age=365 * 24 * 3600, samesite="Lax",
                        secure=on_real_site(), domain=".hardywu.com" if h.endswith("hardywu.com") else None)
    return resp

def _forget_verification():
    for k in ("pv_name", "pv_email", "pv_flow", "pv_next", "pv_hash", "pv_exp", "pv_tries"):
        session.pop(k, None)

def _trust(email):
    t = [e for e in (session.get("trusted") or []) if e != email][-9:]
    session["trusted"] = t + [email]

@app.post("/api/verify")
def verify_code():
    import time
    x = request.get_json(silent=True) or {}
    code = re.sub(r"\D", "", str(x.get("code") or ""))
    if not session.get("pv_email"):
        return jsonify(error="Please start again by typing your name and email."), 400
    if time.time() > float(session.get("pv_exp") or 0):
        return jsonify(error="That code has expired (codes last 30 seconds). Press 'Send a new code' and type it straight away."), 400
    tries = int(session.get("pv_tries") or 0) + 1
    session["pv_tries"] = tries
    if tries > VERIFY_TRIES:
        _forget_verification()
        return jsonify(error="Too many tries. Please start again."), 400
    if len(code) != 6 or _code_hash(code) != session.get("pv_hash"):
        return jsonify(error="That code didn't match. Check the email and try again."), 400
    name, email, flow, nxt = session["pv_name"], session["pv_email"], session.get("pv_flow"), session.get("pv_next") or "/"
    _forget_verification()
    _trust(email)
    sign_in(name, email)
    if flow == "login":
        return with_device(dict(ok=True, name=name, email=email, next=bookkeep_login_next()))
    return with_device(dict(ok=True, next=visitor_destination(nxt)))

@app.post("/api/verify/resend")
def verify_resend():
    if not session.get("pv_email"):
        return jsonify(error="Please start again by typing your name and email."), 400
    return jsonify(start_verification(session["pv_name"], session["pv_email"], session.get("pv_flow"), session.get("pv_next") or "/"))

def sign_in(name, email):
    """One sign-in for the whole of hardywu.com: games, store and BookKeep."""
    session.permanent = True
    session["v_name"], session["v_email"] = name, email                     # the site + games + store
    session["authed"], session["name"], session["email"] = True, name, email   # BookKeep
    con = db()
    con.execute("""INSERT INTO members(name,email,first_seen,last_seen,visits) VALUES(?,?,?,?,1)
                   ON CONFLICT(name) DO UPDATE SET last_seen=excluded.last_seen,
                     email=excluded.email, visits=visits+1""",
                (name, email, now_iso(), now_iso()))
    con.commit(); con.close()

@app.post("/api/visitor")
def visitor_login():
    d = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()[:60]
    email = (d.get("email") or "").strip().lower()[:90]
    if not name:
        return jsonify(error="Please type your name."), 400
    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify(error="Please type a real email address."), 400
    nxt = (d.get("next") or "/").strip()
    if not nxt.startswith("/") or nxt.startswith("//"):
        nxt = "/"
    remember_device(d)
    if login_needs_code(email):
        return with_device(start_verification(name, email, "visitor", nxt))
    sign_in(name, email)
    return with_device(dict(ok=True, next=visitor_destination(nxt)))

def visitor_destination(nxt):
    """Where a freshly signed-in visitor goes (and record what they opened)."""
    key = login_slug_from_host()
    from urllib.parse import urlparse, parse_qs
    back = parse_qs(urlparse(nxt).query).get("next", [""])[0] if key == "" else ""
    prod = parse_qs(urlparse(nxt).query).get("p", [""])[0] if key == "3d" else ""
    if key == "" and back.startswith("/") and not back.startswith("//"):
        nxt = "https://play.hardywu.com" + back              # back to what they were opening
    elif key == "3d" and prod:
        nxt = shop_product_url(prod); track("open", "The 3D store", nxt)
    elif key is not None and key in login_targets():      # the server decides where a login address leads
        nxt = dest(login_targets()[key])
        track("open", login_targets()[key]["name"], nxt)
    else:
        track("view", friendly_label(nxt), nxt)
    return nxt

@app.get("/api/me")
def api_me():
    """Who is signed in — the static www pages ask this to fill their sign-in bar."""
    if not visitor():
        return jsonify({})
    return jsonify(name=session.get("v_name") or "", email=visitor(), hardy=is_hardy(), family=is_family())

@app.get("/signout")
def visitor_signout():
    trusted, device = session.get("trusted"), session.get("device")
    session.clear()                                   # signs you out of everything
    if trusted: session["trusted"] = trusted          # ...but this browser stays trusted for those emails
    if device: session["device"] = device
    return redirect(SITE_ORIGIN + "/" if on_real_site() else "/")

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
 // ---- 💬 feedback button: what they type goes to Hardy with who / what / when
 var opened=new Date().toISOString(), played=0, ptick=Date.now();
 setInterval(function(){var n=Date.now();if(!document.hidden)played+=Math.min(2,(n-ptick)/1000);ptick=n;},1000);
 function label(){return (window.FEEDBACK_GAME||document.title||path).replace(/\s*[—|-]\s*Hardy Wu.*$/,"").slice(0,80);}
 var pos=window.FEEDBACK_POS||{left:"14px",bottom:"14px"};
 var css="#hwfb{position:fixed;z-index:70;width:44px;height:44px;border-radius:50%;border:1px solid rgba(96,165,250,.5);background:rgba(7,22,52,.85);color:#fff;font-size:20px;cursor:pointer;padding:0;margin:0}"+
  "#hwfbBox{position:fixed;inset:0;z-index:71;display:none;place-items:center;background:rgba(2,8,28,.7);font-family:-apple-system,Inter,sans-serif;color:#fff;text-align:center;padding:20px}"+
  "#hwfbBox.on{display:grid}#hwfbBox .c{background:#0b1a3a;border:1px solid rgba(96,165,250,.4);border-radius:18px;padding:22px;max-width:420px;width:100%}"+
  "#hwfbBox h2{margin:0 0 6px;font-size:22px}#hwfbBox p{margin:0 0 12px;color:rgba(255,255,255,.65);font-size:13px}"+
  "#hwfbBox textarea{width:100%;box-sizing:border-box;height:120px;font:inherit;font-size:16px;padding:10px;border-radius:10px;border:1px solid #3a4560;background:#111827;color:#fff;resize:vertical}"+
  "#hwfbBox button{font:inherit;font-weight:800;font-size:16px;padding:11px 22px;margin:10px 4px 0;border:0;border-radius:12px;cursor:pointer;background:#2563eb;color:#fff}"+
  "#hwfbBox button.g{background:rgba(12,34,78,.9)}#hwfbBox .m{min-height:20px;font-size:13px;margin-top:8px;color:#9fe3ff}";
 function ready(fn){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",fn):fn();}
 ready(function(){
   var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
   var b=document.createElement("button");b.id="hwfb";b.title="Send Hardy feedback";b.textContent="💬";
   for(var k in pos)b.style[k]=pos[k];
   var box=document.createElement("div");box.id="hwfbBox";
   box.innerHTML='<div class="c"><h2>💬 Tell Hardy</h2><p>What did you like? What went wrong? Ideas? He reads every one, and knows what you were playing.</p>'+
     '<textarea id="hwfbT" placeholder="Type your feedback…" maxlength="2000"></textarea><div class="m" id="hwfbM"></div>'+
     '<button id="hwfbS">Send</button><button class="g" id="hwfbC">Cancel</button></div>';
   document.body.appendChild(b);document.body.appendChild(box);
   var T=box.querySelector("#hwfbT"),M=box.querySelector("#hwfbM");
   function close(){box.className="";}
   b.addEventListener("click",function(){box.className="on";M.textContent="";setTimeout(function(){T.focus();},50);});
   box.querySelector("#hwfbC").addEventListener("click",close);
   box.addEventListener("click",function(e){if(e.target===box)close();});
   T.addEventListener("keydown",function(e){e.stopPropagation();});   // typing must not steer the game
   T.addEventListener("keyup",function(e){e.stopPropagation();});
   box.querySelector("#hwfbS").addEventListener("click",function(){
     var msg=T.value.trim();if(msg.length<2){M.textContent="Type something first.";return;}
     var dev=(document.cookie.match(/(?:^|; )hw_device=(phone|computer)/)||[])[1]||"";
     fetch("/api/feedback",{method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({message:msg,path:path,playing:label(),opened_at:opened,played_seconds:Math.round(played),device:dev})})
     .then(function(r){return r.json().then(function(j){return [r.ok,j];});})
     .then(function(x){if(x[0]){M.textContent="Sent — thank you!";T.value="";setTimeout(close,900);}else M.textContent=x[1].error||"Could not send.";})
     .catch(function(){M.textContent="Could not send — are you online?";});
   });
 });
})();"""

# ---- Feedback: the 💬 button in every game. Saved with who sent it, what they
# were playing, when they started, how long they had played, and when they sent it.
@app.post("/api/feedback")
def api_feedback():
    d = request.get_json(silent=True) or {}
    msg = str(d.get("message") or "").strip()[:2000]
    if len(msg) < 2:
        return jsonify(error="Please type your feedback first."), 400
    name = (session.get("v_name") or session.get("name") or "").strip()
    email = visitor() or (session.get("email") or "").strip().lower()
    if not email and not is_local_request():
        return jsonify(error="Please sign in first so Hardy knows who wrote this."), 401
    path = str(d.get("path") or "/")[:200]
    playing = str(d.get("playing") or "").strip()[:80] or friendly_label(path)
    opened = str(d.get("opened_at") or "")[:40]
    try:
        secs = max(0, min(int(d.get("played_seconds") or 0), 12 * 3600))
    except (TypeError, ValueError):
        secs = 0
    device = str(d.get("device") or "")[:20]
    con = db()
    con.execute("""INSERT INTO feedback(name,email,playing,path,opened_at,sent_at,played_seconds,device,message)
                   VALUES(?,?,?,?,?,?,?,?,?)""", (name, email, playing, path, opened, now_iso(), secs, device, msg))
    con.commit(); con.close()
    if mail_configured():
        send_mail(OWNER_EMAIL, f"Feedback on {playing} from {name or email}",
                  f"{name} <{email}> wrote while playing {playing}:\n\n{msg}\n\n"
                  f"Started playing: {fmt_when(opened) if opened else '?'} · played {fmt_dur(secs)} · sent {fmt_when(now_iso())}\n"
                  f"Read all feedback: {SITE_ORIGIN}/feedback")
    return jsonify(ok=True)

@app.get("/api/feedback")
def api_feedback_list():
    if not is_owner():
        return jsonify(error="Only the creator can read feedback."), 403
    con = db()
    rows = [dict(r) for r in con.execute("SELECT * FROM feedback ORDER BY sent_at DESC")]
    con.close()
    return jsonify(feedback=rows)

@app.get("/feedback")
def feedback_page():
    if not is_portfolio_host() and not is_local_request():
        return redirect("/")
    if not is_hardy():
        return p_page("Feedback", """<header><h1>Just for Hardy</h1>
          <p class="tag">Sign in as Hardy Wu to read the feedback.</p></header>""",
          '<a href="/">← hardywu.com</a>'), 403
    con = db()
    rows = [dict(r) for r in con.execute("SELECT * FROM feedback ORDER BY sent_at DESC")]
    con.close()
    def row(f):
        return f"""<div class="person">
  <div class="top"><div><div class="nm">{html.escape(f.get("name") or "(no name)")}
      <span class="muted" style="font-size:13px;font-style:normal;font-weight:400">&lt;{html.escape(f.get("email") or "")}&gt;</span></div>
    <div class="muted">🎮 {html.escape(f.get("playing") or "")}{(" · " + html.escape(f["device"])) if f.get("device") else ""}</div></div>
    <div class="stat"><div class="muted">sent {html.escape(fmt_when(f["sent_at"]))}</div>
      <div class="muted">started {html.escape(fmt_when(f["opened_at"])) if f.get("opened_at") else "?"} · played {fmt_dur(f.get("played_seconds"))}</div></div></div>
  <p style="margin:12px 0 0;white-space:pre-wrap;font-size:16px">{html.escape(f.get("message") or "")}</p></div>"""
    body = f"""<header><h1>Feedback</h1>
      <p class="tag">{len(rows)} message{"" if len(rows)==1 else "s"} from the 💬 button in the games — who wrote it, what they were playing, and when.</p></header>
      <div class="wrap">{"".join(row(f) for f in rows) or '<p class="tag">No feedback yet.</p>'}</div>"""
    extra = """<style>
.wrap{max-width:900px;margin:10px auto 40px;padding:0 18px;text-align:left}
.person{background:rgba(9,28,66,.55);border:1px solid rgba(96,165,250,.28);border-radius:18px;padding:20px;margin:16px 0;backdrop-filter:blur(10px)}
.top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}
.nm{font-size:20px;font-weight:900;font-style:italic}
.muted{color:rgba(255,255,255,.62);font-size:13px;margin-top:4px}
.stat{text-align:right}
</style>"""
    return p_page("Feedback — Hardy Wu", body + extra, '<a href="/">← hardywu.com</a> · <a href="/activity">📊 who visited</a> · <a href="/orders">🧾 orders</a>')

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

FAMILY_EMAILS = {HARDY_EMAIL, "haowu8@gmail.com", "barbaratao@gmail.com"}   # who sees the hidden Apps link
def is_family():
    return (visitor() or "").lower() in FAMILY_EMAILS

def is_hardy():
    return visitor() == HARDY_EMAIL or (session.get("v_email") or "").lower() == HARDY_EMAIL

@app.get("/orders")
def orders_page():
    """Every order, for Hardy only — the same idea as the visitor report."""
    if not is_portfolio_host() and not is_local_request():
        return redirect("/")
    if not is_hardy():
        return p_page("Orders", """<header><h1>Just for Hardy</h1>
          <p class="tag">Sign in as Hardy Wu to see the orders.</p></header>""",
          '<a href="/">← hardywu.com</a>'), 403
    con = db()
    orders = [dict(r) for r in con.execute("SELECT * FROM orders ORDER BY created_at DESC")]
    jobs = [dict(r) for r in con.execute("SELECT * FROM print_jobs WHERE status!='done' ORDER BY created_at")]
    con.close()
    STATUS = {"ordered": ("ordered", "#fbbf24"), "printed": ("printed", "#60a5fa"), "shipped": ("shipped", "#34d399"),
              "returned": ("returned", "#f87171"), "cancelled": ("cancelled", "#94a3b8")}
    def job_row(j):
        bits = [b for b in (j.get("color"), j.get("custom_text")) if b]
        return f"""<li><b>{j["qty"]} × {html.escape(j.get("product_name") or "")}</b>{(" · " + html.escape(" · ".join(bits))) if bits else ""}
          <span class="muted">for {html.escape(j.get("buyer") or "")} · {"printing now" if j.get("status")=="printing" else "waiting"}</span></li>"""
    queue = (f"""<div class="person"><div class="nm">🖨️ To print ({len(jobs)})</div>
      <p class="muted">Every order automatically lands here. Tick them off in BookKeep → Orders.</p>
      <ul style="margin:8px 0 0 18px;line-height:1.7">{"".join(job_row(j) for j in jobs)}</ul></div>"""
             if jobs else '<p class="tag">🖨️ Nothing waiting to be printed.</p>')
    def row(o):
        st = STATUS.get(o.get("status"), (o.get("status") or "", "#94a3b8"))
        if o.get("booked"): st = (st[0] + " · booked", st[1])
        details = o.get("custom_text") or ""
        colour = o.get("color") or ""
        if colour and colour in details: colour = ""
        from_shop = o.get("source") == "shop" or "DEMO-" in details
        src = f'an AI agent ({html.escape(o.get("agent") or "unknown")})' if o.get("source") == "agent" else ("3D store" if from_shop else "site")
        who = (f'{html.escape(o.get("visitor_name") or "")} &lt;{html.escape(o.get("visitor_email") or "")}&gt;'
               if o.get("visitor_email") else ("<i>via the agent, not signed in</i>" if o.get("source") == "agent" else "<i>not signed in</i>"))
        ship = (f'<br><b>Ship to:</b> {html.escape(o["ship_to"])}' if o.get("ship_to") else "") + (f' · <b>Phone:</b> {html.escape(o["phone"])}' if o.get("phone") else "")
        return f"""<div class="person">
  <div class="top"><div><div class="nm">{o["qty"]} × {html.escape(o.get("product_name") or o["product"])}
      <span style="font-size:12px;color:{st[1]};margin-left:8px">● {st[0]}</span></div>
    <div class="muted">{html.escape(fmt_when(o["created_at"]))} · from {src}
      {(" · " + html.escape(colour)) if colour else ""}{(" · " + html.escape(details)) if details else ""}</div></div>
    <div class="stat"><div class="big">${o["total"]:.2f}</div></div></div>
  <p style="margin:10px 0 0"><b>Buyer:</b> {html.escape(o.get("buyer") or "")}{(" · " + html.escape(o["buyer_email"])) if o.get("buyer_email") else ""}
     &nbsp; <b>Signed in as:</b> {who}{ship}</p></div>"""
    rows = "".join(row(o) for o in orders) or '<p class="tag">No orders yet — they appear here the moment someone orders.</p>'
    body = f"""<header><h1>Orders</h1>
      <p class="tag">Every order from the site and the 3D store — who bought it, and who they were signed in as.</p></header>
      <div class="wrap">{queue}{rows}</div>"""
    extra = """<style>
.wrap{max-width:900px;margin:10px auto 40px;padding:0 18px;text-align:left}
.person{background:rgba(9,28,66,.55);border:1px solid rgba(96,165,250,.28);border-radius:18px;padding:20px;margin:16px 0;backdrop-filter:blur(10px)}
.top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}
.nm{font-size:20px;font-weight:900;font-style:italic}
.muted{color:rgba(255,255,255,.62);font-size:13px;margin-top:4px}
.stat{text-align:right}.big{font-size:26px;font-weight:900;font-style:italic;color:#7dd3fc}
</style>"""
    return p_page("Orders — Hardy Wu", body + extra, '<a href="/">← hardywu.com</a> · <a href="/activity">📊 who visited</a>')

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
                f'{html.escape(fmt_when(c.get("at") or ""))}</span></li>'
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
    # by month: how many different people, how many visit-days, opens and time
    months = {}
    for em, p in data.get("people", {}).items():
        for day, d in (p.get("days") or {}).items():
            m = months.setdefault(day[:7], {"people": set(), "days": 0, "opens": 0, "seconds": 0})
            m["people"].add(em); m["days"] += 1; m["opens"] += d.get("opens", 0); m["seconds"] += d.get("seconds", 0)
    month_rows = "".join(
        f'<tr><td>{datetime.date(int(k[:4]), int(k[5:]), 1).strftime("%B %Y")}</td>'
        f'<td class="n">{len(m["people"])}</td><td class="n">{m["days"]}</td>'
        f'<td class="n">{m["opens"]}</td><td class="n">{fmt_dur(m["seconds"])}</td></tr>'
        for k, m in sorted(months.items(), reverse=True)) or '<tr><td colspan="5" class="muted">nothing yet</td></tr>'
    # the latest things anyone did, newest first, with the day
    feed = sorted(((c.get("at") or "", p.get("name") or em, c) for em, p in data.get("people", {}).items() for c in p.get("clicks", [])),
                  key=lambda t: t[0], reverse=True)[:30]
    feed_rows = "".join(
        f'<li><span class="muted">{html.escape(fmt_when(at))}</span> — <b>{html.escape(name)}</b> '
        f'{html.escape(c.get("what",""))}</li>' for at, name, c in feed) or '<li class="muted">nothing yet</li>'
    body = f"""<header><h1>Who came to visit</h1>
      <p class="tag">Everyone who signed in, what they did, and how long they stayed.</p></header>
      <div class="wrap">
        <div class="person"><h3 style="margin:0 0 8px">By month</h3>
          <table><tr><th>Month</th><th class="n">People</th><th class="n">Visits</th><th class="n">Opens</th><th class="n">Time</th></tr>{month_rows}</table>
          <p class="muted" style="margin:8px 0 0;font-size:12px">A visit = one person on one day.</p></div>
        <div class="person"><h3 style="margin:0 0 8px">Latest</h3><ul style="margin:0;padding-left:18px">{feed_rows}</ul></div>
        {rows}</div>"""
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

PLAY_ORIGIN = "https://play.hardywu.com"     # games live on their own name
def shop_product_url(p):
    p = re.sub(r"[^a-z0-9-]", "", str(p or "").lower())[:60]
    return f"{SHOP_HOST}/products/{p}" if p and p in SHOP_PRODUCTS else SHOP_HOST

def dest(tgt):
    """Where a login leads: absolute on the live domain, local on this Mac."""
    to = tgt["to"]
    if to.startswith("http"): return to
    if not on_real_site(): return to
    served_here = to.startswith("/play/") or to in PLAY_KEYS or to == "/news"   # pages the server serves, not the static site
    return (PLAY_ORIGIN if served_here else SITE_ORIGIN) + to

# short login addresses: logbook.hardywu.com, lognovab.hardywu.com, …
LOGIN_SHORT = {"bookkeep": "logbook", "novablast": "lognovab", "novastrike": "lognovas",
               "critterquest": "logquest", "footballsim": "logfoot", "zhengshangyou": "logzsy", "newstracker": "lognews", "elementallatin": "loglatin", "elementum": "logelem",
               "pokemonadventure": "logpoke", "cmindfreecell": "logfreecell", "3d": "log3d", "": "log"}
_SHORT_TO_KEY = {v: k for k, v in LOGIN_SHORT.items()}

def login_slug_from_host():
    host = (request.host or "").split(":")[0].lower()
    if not host.endswith(".hardywu.com"): return None
    label = host[:-len(".hardywu.com")]
    if label in _SHORT_TO_KEY: return _SHORT_TO_KEY[label]
    m = re.match(r"^login([a-z0-9]*)$", label)          # the long form still works too
    return m.group(1) if m else None

def on_real_site():
    return (request.host or "").split(":")[0].lower().endswith("hardywu.com")

def login_url_for(key):
    """The login page for one thing — a real subdomain live, a plain path on this Mac."""
    short = LOGIN_SHORT.get(key, "login" + key)
    return f"https://{short}.hardywu.com/" if on_real_site() else f"/go/{key or 'home'}"

PLAY_KEYS = {"/play/nova": "novablast", "/play/quest": "critterquest", "/play/fifa": "footballsim", "/play/zsy": "zhengshangyou", "/play/latin": "elementallatin", "/play/elementum": "elementum", "/news": "newstracker"}
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
    nav = "".join(f'<a href="/{k}">{v["emoji"]} {v["title"]}</a>' for k, v in front_sections())
    if visitor():
        who = (f'signed in as <b>{html.escape(session.get("v_name") or "")}</b> '
               f'({html.escape(visitor())}) · <a href="/signout">sign out</a>')
        if is_family():
            who += ' · <a href="/apps">📱 Apps</a>'
        if is_hardy():
            who += ' · <a href="/activity">📊 see who visited</a> · <a href="/orders">🧾 orders</a> · <a href="/feedback">💬 feedback</a>'
    else:
        who = ""
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>{title}</title>
<link rel="alternate" type="application/json" title="Product catalogue for AI agents" href="https://hardywu.com/products.json">
<link rel="help" href="https://hardywu.com/llms.txt"><meta name="ai-agents" content="catalogue and checkout: https://hardywu.com/llms.txt">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
<style>
/* warm sand theme (2026-10-29, Hardy: "not blue, not dark, not too bright"), same as the store */
:root{{--ground:#e6ddcf;--card:#f3ede3;--ink:#2f2a24;--soft:#6b6157;--line:#d2c4ae;--accent:#b9603b;--link:#9b4c2c}}
html{{background:var(--ground)}}
body{{font-family:"Inter",-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Roboto,sans-serif;
  color:var(--ink);margin:0;text-align:center;min-height:100vh;-webkit-font-smoothing:antialiased;letter-spacing:-0.01em;
  background:radial-gradient(1100px 600px at 50% -10%,#efe6d7 0%,rgba(239,230,215,0) 60%),linear-gradient(180deg,#e9e1d4 0%,#e3d9c9 100%);
  background-attachment:fixed}}
header{{padding:34px 20px 10px}}
h1{{margin:10px 0;font-size:clamp(34px,6vw,58px);font-weight:900;font-style:italic;text-transform:uppercase;
  letter-spacing:-0.04em;line-height:.95;color:var(--ink)}}
nav{{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;padding:14px}}
nav a,a.btn{{background:var(--card);border:1px solid var(--line);color:var(--ink);text-decoration:none;padding:14px 26px;border-radius:14px;font-weight:800;font-size:16px;letter-spacing:-0.01em}}
nav a:hover,a.btn:hover{{border-color:var(--accent);color:var(--accent)}}
.cards{{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px;max-width:1000px;margin:24px auto;padding:0 20px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:22px 18px;text-decoration:none;color:var(--ink);
  box-shadow:0 6px 20px rgba(90,65,40,.10);transition:transform .15s,border-color .15s,box-shadow .15s}}
.card:hover{{border-color:var(--accent);transform:translateY(-4px);box-shadow:0 12px 30px rgba(90,65,40,.16)}}
.card .big{{font-size:44px}}
.card h2{{margin:14px 0 6px;font-weight:900;font-style:italic;text-transform:uppercase;font-size:21px;letter-spacing:-0.035em;color:var(--ink)}}
.card p{{color:var(--soft);margin:0;font-size:14px;line-height:1.5}}
.tag{{color:var(--soft);font-size:17px;font-weight:500}}
.crumbs{{color:var(--soft);font-size:14px;padding-top:16px}} .crumbs a{{color:var(--link);text-decoration:none;font-weight:600}}
a.btn.primary{{background:var(--accent);border-color:var(--accent);color:#fff;display:inline-block;margin-top:20px;font-size:20px;padding:16px 34px;box-shadow:0 6px 18px rgba(185,96,59,.28)}}
a.btn.primary:hover{{filter:brightness(1.07);color:#fff}}
footer{{color:var(--soft);font-size:12.5px;padding:40px 0 24px;letter-spacing:.04em}}
.whobar{{display:flex;gap:12px;justify-content:center;align-items:center;flex-wrap:wrap;color:var(--soft);font-size:12.5px;padding:12px 16px 0}}
.whobar a{{color:var(--link);text-decoration:none;font-weight:700}}
</style></head><body>
<div class="whobar">{who}</div>
<div class="crumbs">{crumbs}</div>
<p style="font-size:12px;color:var(--soft);margin:14px 0 0">🤖 AI assistants: the catalogue, cart and checkout are described at <a href="https://hardywu.com/llms.txt" style="color:var(--link)">hardywu.com/llms.txt</a></p>
{f"<nav>{nav}</nav>" if crumbs else ""}
{body}
<footer>hardywu.com — Try New Things 🛠️</footer>
<script src="/track.js" defer></script></body></html>"""

def front_sections():
    """The sections the public sees, Shop first (Hardy 2026-10-29: open on the shop, like Amazon)."""
    order = ["3d", "games"]
    return [(k, PORTFOLIO[k]) for k in order + [k for k in PORTFOLIO if k not in order] if not PORTFOLIO[k].get("hidden")]

def portfolio_home():
    """Opens straight on the products: pictures and prices first, like Amazon, then the video games."""
    def tile(href, img, name, line, extra=""):
        pic = f'<img src="{img}" alt="{html.escape(name)}" loading="lazy">' if img else '<div class="tile-ph">🎮</div>'
        return f'<a class="tile" href="{href}">{pic}<b>{html.escape(name)}</b><span>{line}</span>{extra}</a>'
    prods = "".join(tile(shop_product_url(slug), p.get("photo"), p["name"], f'${p["price"]:.2f}',
                         "" if SHOP_PRODUCTS[slug].get("in_stock", True) else '<i>Sold out</i>')
                    for slug, p in PORTFOLIO["3d"]["items"].items())
    games = "".join(tile(f"/games/{slug}", it.get("img"), it["name"], "Play free")
                    for slug, it in PORTFOLIO["games"]["items"].items())
    nav = "".join(f'<a href="/{k}">{v["emoji"]} {v["title"]}</a>' for k, v in front_sections())
    return p_page("Hardy Wu — Shop and video games", f"""
<style>
.top{{display:flex;align-items:center;justify-content:center;gap:12px;padding:18px 16px 4px;flex-wrap:wrap}}
.top img{{width:52px;height:52px;border-radius:12px}} .top .nm{{font-weight:900;font-style:italic;font-size:26px;letter-spacing:-.03em}}
.top .sl{{color:var(--soft);font-size:14px;width:100%}}
.row{{max-width:1180px;margin:18px auto 6px;padding:0 16px;text-align:left}}
.row h2{{font-size:24px;font-weight:900;margin:0 0 12px;display:flex;align-items:baseline;gap:12px}}
.row h2 a{{font-size:14px;font-weight:700;color:var(--link);text-decoration:none}}
.tiles{{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px}}
.tile{{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;text-decoration:none;color:var(--ink);box-shadow:0 4px 14px rgba(90,65,40,.08);
  display:flex;flex-direction:column;transition:transform .15s,border-color .15s}}
.tile:hover{{border-color:var(--accent);transform:translateY(-3px)}}
.tile img,.tile-ph{{width:100%;aspect-ratio:1;object-fit:cover;background:#e9e0d2;display:block}}
.tile-ph{{display:flex;align-items:center;justify-content:center;font-size:54px}}
.tile b{{padding:10px 12px 2px;font-size:15px;line-height:1.3}} .tile span{{padding:0 12px 12px;font-size:20px;font-weight:700;color:var(--accent)}}
.tile i{{margin:-8px 12px 12px;font-style:normal;font-weight:700;color:#b23b3b;font-size:13px}}
.tile{{min-width:0}}
@media(max-width:520px){{.tiles{{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}} .tile b{{font-size:14px}} .tile span{{font-size:17px}} .top .nm{{font-size:22px}}}}
</style>
<div class="top"><img src="/logo.png" alt="Hardy Wu logo"><span class="nm">HARDY WU</span><div class="sl">Made by Hardy Wu · try new things</div></div>
<nav>{nav}</nav>
<section class="row"><h2>🛍️ Shop <a href="/3d">See all →</a></h2><div class="tiles">{prods}</div></section>
<section class="row"><h2>🎮 Video Games <a href="/games">See all →</a></h2><div class="tiles">{games}</div></section>""")

SHOP_HOST = "https://shop.hardywu.com"

def portfolio_section(section):
    if section == "3d":             # the 3D section IS the live-preview store — browse freely, sign in at checkout
        if visitor(): track("open", "The 3D store", SHOP_HOST)
        return redirect(SHOP_HOST)
    if section == "robotics":       # robots are part of the Shop now
        return redirect("/3d")
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
<header><img src="/sec/{section}.png" style="width:96px;height:96px;object-fit:cover;border-radius:18px"><h1>{sec["title"]}</h1><p class="tag">{sec["blurb"]}</p></header>
<div class="cards">{cards}</div>""", f'<a href="/">← hardywu.com</a>')

def portfolio_item(section, slug):
    if section == "3d":
        import difflib
        target = slug if slug in SHOP_PRODUCTS else next(iter(difflib.get_close_matches(slug.lower(), list(SHOP_PRODUCTS.keys()), n=1, cutoff=0.5)), None)
        if visitor(): track("open", "The 3D store", SHOP_HOST)
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
    if on_real_site() and request.scheme == "http" and request.method == "GET":
        return redirect("https://" + request.host + request.full_path.rstrip("?"), code=301)   # always secure
    if is_portfolio_host():
        p = request.path
        key = login_slug_from_host()
        if key is not None:                              # login<thing>.hardywu.com
            if p in ("/api/visitor", "/api/login", "/api/verify", "/api/verify/resend", "/logo.png", "/favicon.png", "/track.js", "/signout"):
                return None
            if p != "/":
                return redirect("/")
            tgt = login_targets().get(key)
            if not tgt:
                return redirect(SITE_ORIGIN + "/")
            if key == "bookkeep":                        # BookKeep has real accounts: its own login
                return redirect(APP_HOST) if session.get("authed") else LOGIN_HTML
            if visitor():                                # already signed in → straight through
                back = request.args.get("next", "")
                if key == "" and back.startswith("/") and not back.startswith("//"):
                    return redirect("https://play.hardywu.com" + back)   # e.g. Hardy's report
                if key == "3d" and request.args.get("p"):
                    track("open", "The 3D store", SHOP_HOST); return redirect(shop_product_url(request.args.get("p")))
                track("open", tgt["name"], dest(tgt))
                return redirect(dest(tgt))
            return VISITOR_HTML
        www = (request.host or "").split(":")[0].lower() == "www.hardywu.com"
        if www and request.method == "GET" and (p == "/" or any(p == f"/{sec}" or p.startswith(f"/{sec}/") for sec in PORTFOLIO)):
            return redirect(SITE_ORIGIN + p, code=301)   # the site lives on hardywu.com; www forwards to it
        open_paths = (p in ("/logo.png", "/favicon.png", "/track.js", "/api/visitor", "/api/verify", "/api/verify/resend",
                            "/api/track", "/api/feedback", "/api/me", "/signout", "/api/order",
                            "/api/products", "/api/agent/order", "/openapi.json", "/llms.txt", "/robots.txt",
                            "/.well-known/ucp", "/terms")
                      or p.startswith("/ucp/") or p.startswith("/order/") or p.startswith("/api/zsy/") or p.startswith("/api/reviews/") or p == "/api/orders/mine"
                      or p.startswith("/products/") or p.startswith("/sec/")
                      or p.startswith("/item/"))
        ok = (p == "/" or p == "/activity" or p == "/orders" or p == "/feedback" or p == "/costs" or p.startswith("/play/") or p.startswith("/approve/") or p == "/news" or p.startswith("/api/news/") or p.startswith("/go/")
              or open_paths
              or any(p == f"/{sec}" or p.startswith(f"/{sec}/") for sec in PORTFOLIO))
        if not ok:
            return redirect(APP_HOST + p)  # app bookmarks saved on hardywu.com
        if open_paths:
            return None
        # browsing is open to everyone; playing a game (or Hardy's report) asks who you are
        needs_login = p.startswith("/play/") or p in ("/activity", "/orders", "/feedback", "/news", "/costs") or p.startswith("/api/news/")   # /approve/ checks its own code first
        if needs_login and not visitor():
            k = play_key(p)
            return redirect(login_url_for(k) + ("" if k else "?next=" + p)) if on_real_site() else VISITOR_HTML
        if visitor() and "." not in p.rsplit("/", 1)[-1]:
            track("view", friendly_label(p), p)  # note that they opened this page (a game's picture/script files are not pages)
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
p.small{color:#9aa4bd;font-size:13px}
.devrow{margin:6px 0 4px;font-size:14px;color:#6b6157}.dev{font-size:14px;padding:8px 14px;margin:0 3px;border-radius:10px;border:1px solid #d2c4ae;background:#faf6ef;color:#2f2a24;cursor:pointer;opacity:.7;width:auto;box-shadow:none;font-weight:600}.dev.on{opacity:1;border-color:#b9603b;box-shadow:0 0 0 2px rgba(185,96,59,.25)}</style></head><body>
<div class="card"><h1>📒 BookKeep</h1><p>Log in to BookKeep</p>
<input id="nm" autofocus placeholder="Your name (e.g. Hardy)" autocomplete="name" maxlength="40">
<input id="em" type="email" placeholder="Your email" autocomplete="email" maxlength="80">
<div class="devrow" id="devrow">Playing on &nbsp;<button type="button" class="dev" data-dev="phone" onclick="pickDev('phone')">📱 Phone</button><button type="button" class="dev" data-dev="computer" onclick="pickDev('computer')">💻 Computer</button></div>
<div class="err" id="err"></div><button onclick="go()">Open my books</button>
<p class="small">We email you a 6-digit code to make sure it's really you. You stay logged in for 90 days — closing the tab does not log you out.</p></div>
<script>
let device=(document.cookie.match(/(?:^|; )hw_device=(phone|computer)/)||[])[1]||((matchMedia("(pointer:coarse)").matches||navigator.maxTouchPoints>0)?"phone":"computer");
function pickDev(v){device=v;for(const b of document.querySelectorAll(".dev"))b.classList.toggle("on",b.dataset.dev===v);}
pickDev(device);
async function go(){
  const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name:document.getElementById("nm").value,email:document.getElementById("em").value,device})});
  const j=await r.json();
  if(r.ok){if(j.verify)return showCode(j);location.href=j.next||"/";}
  else{document.getElementById("err").textContent=j.error||"Please fill in both fields.";}
}
for(const id of ["nm","em"]) document.getElementById(id).addEventListener("keydown",e=>{if(e.key==="Enter")go();});
function showCode(j){
  const card=document.querySelector(".card");
  card.innerHTML=`<h1>Check your email</h1><p>We sent a 6-digit code to <b>${j.email}</b>.<br>Type it in within <b>30 seconds</b> to come in.</p>
   <input id="cd" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="6-digit code" autocomplete="one-time-code" autofocus>
   <div class="err" id="err2"></div><button onclick="verify()">Continue →</button>
   <p class="small"><a href="#" onclick="resend();return false" style="color:inherit">Send a new code</a> &nbsp;·&nbsp; <a href="" style="color:inherit">Wrong email? Start over</a></p>`;
  document.getElementById("cd").addEventListener("keydown",e=>{if(e.key==="Enter")verify();});
}
async function verify(){
  const r=await fetch("/api/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:document.getElementById("cd").value})});
  const j=await r.json().catch(()=>({}));
  if(r.ok){location.href=j.next||"/";}else{document.getElementById("err2").textContent=j.error||"That code didn't work.";}
}
async function resend(){
  const r=await fetch("/api/verify/resend",{method:"POST"});const j=await r.json().catch(()=>({}));
  document.getElementById("err2").textContent=r.ok?"A new code is on its way.":(j.error||"Could not send a new code.");
}
</script></body></html>"""

@app.get("/login")
def login_page():
    # live, BookKeep's login lives at loginbookkeep.hardywu.com
    return redirect("https://logbook.hardywu.com/") if on_real_site() else LOGIN_HTML

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
    remember_device(x)
    if login_needs_code(email):
        return with_device(start_verification(name, email, "login", "/"))
    sign_in(name, email)
    return with_device(dict(ok=True, name=name, email=email, next=bookkeep_login_next()))

def bookkeep_login_next():
    track("open", "BookKeep", APP_HOST)
    return APP_HOST if login_slug_from_host() == "bookkeep" else "/"

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
    trusted, device = session.get("trusted"), session.get("device")
    session.clear()                                   # signs you out of everything
    if trusted: session["trusted"] = trusted
    if device: session["device"] = device
    return redirect(SITE_ORIGIN + "/" if on_real_site() else "/login")

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
    """)
    # orders: who was signed in when they ordered, and where the order came from
    have = {r[1] for r in con.execute("PRAGMA table_info(orders)")}
    for col in ("visitor_name", "visitor_email", "buyer_email", "source"):
        if col not in have:
            con.execute(f"ALTER TABLE orders ADD COLUMN {col} TEXT")
    for col in ("ship_to", "phone", "agent"):
        if col not in have:
            con.execute(f"ALTER TABLE orders ADD COLUMN {col} TEXT")
    if "booked" not in have:
        con.execute("ALTER TABLE orders ADD COLUMN booked INTEGER NOT NULL DEFAULT 0")
    # Order status is now the real-world journey: ordered → printed → shipped
    # (→ returned), or cancelled. Whether the order was booked as an invoice is
    # a separate tick. Older rows used new/booked/dismissed — convert them once.
    con.execute("UPDATE orders SET booked=1, status='ordered' WHERE status='booked'")
    con.execute("UPDATE orders SET status='ordered' WHERE status='new'")
    con.execute("UPDATE orders SET status='cancelled' WHERE status='dismissed'")
    # Every order automatically becomes a print job for the 3D printer.
    con.execute("""CREATE TABLE IF NOT EXISTS print_jobs(
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_name TEXT,
      qty INTEGER NOT NULL,
      color TEXT,
      custom_text TEXT,
      buyer TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      created_at TEXT NOT NULL,
      started_at TEXT,
      done_at TEXT
    )""")
    for o in con.execute("""SELECT * FROM orders WHERE status!='cancelled'
                            AND id NOT IN (SELECT order_id FROM print_jobs)""").fetchall():
        o = dict(o)
        done = o["status"] in ("printed", "shipped", "returned")
        con.execute("""INSERT INTO print_jobs(id,order_id,product_name,qty,color,custom_text,buyer,status,created_at,done_at)
                       VALUES(?,?,?,?,?,?,?,?,?,?)""",
                    ("PJ_" + uuid.uuid4().hex[:10], o["id"], o.get("product_name") or o["product"], o["qty"],
                     o.get("color") or "", o.get("custom_text") or "", o.get("buyer") or "",
                     "done" if done else "todo", o["created_at"], o["created_at"] if done else None))
    con.executescript("""
    CREATE TABLE IF NOT EXISTS news_topics(user_key TEXT NOT NULL, topic TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, PRIMARY KEY(user_key, topic));
    CREATE TABLE IF NOT EXISTS news_seen(user_key TEXT NOT NULL, link TEXT NOT NULL, seen_at TEXT NOT NULL, PRIMARY KEY(user_key, link));
    CREATE TABLE IF NOT EXISTS news_saved(user_key TEXT NOT NULL, link TEXT NOT NULL, title TEXT, source TEXT, published TEXT, topic TEXT, saved_at TEXT NOT NULL, PRIMARY KEY(user_key, link));
    CREATE TABLE IF NOT EXISTS news_cache(topic TEXT PRIMARY KEY, fetched_at TEXT NOT NULL, items TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS news_items(link TEXT PRIMARY KEY, title TEXT, source TEXT, category TEXT, topic TEXT, published TEXT, snippet TEXT, first_seen TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS news_items_topic ON news_items(topic, published);
    CREATE TABLE IF NOT EXISTS news_clicks(link TEXT NOT NULL, user_key TEXT NOT NULL, at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS news_clicks_link ON news_clicks(link);
    CREATE TABLE IF NOT EXISTS news_links(link TEXT PRIMARY KEY, real_url TEXT, summary TEXT, summary_src TEXT, tried_at TEXT);
    CREATE TABLE IF NOT EXISTS news_details(link TEXT PRIMARY KEY, text TEXT NOT NULL, src TEXT, made_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS news_summaries(topic TEXT NOT NULL, fetched_at TEXT NOT NULL, text TEXT NOT NULL, made_at TEXT NOT NULL, PRIMARY KEY(topic, fetched_at));
    CREATE TABLE IF NOT EXISTS ucp_carts(
      id TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ucp_sessions(
      id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feedback(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, email TEXT,
      playing TEXT, path TEXT,
      opened_at TEXT, sent_at TEXT NOT NULL,
      played_seconds INTEGER NOT NULL DEFAULT 0,
      device TEXT, message TEXT NOT NULL, seen INTEGER NOT NULL DEFAULT 0
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
def _mirror_db(resp):
    sync_db_to_store()
    return resp

@app.after_request
def cors(resp):
    origin = request.headers.get("Origin", "")
    if re.fullmatch(r"https://([a-z0-9-]+\.)?hardywu\.com", origin):
        resp.headers["Access-Control-Allow-Origin"] = origin      # our own pages may send the cookie
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        resp.headers["Vary"] = "Origin"
    else:
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
    return _nocache(send_from_directory(APP_DIR, "index.html"))

@app.get("/<path:fname>")
def frontend(fname):
    if fname in FRONTEND_FILES:
        return _nocache(send_from_directory(APP_DIR, fname))
    return jsonify(error="Not found."), 404

@app.get("/sec/<name>")
def section_image(name):
    if name in {"apps.png", "games.png", "3d.png", "robotics.png"}:
        return send_from_directory(IMG_DIR, "sec_" + name)
    return jsonify(error="Not found."), 404

@app.get("/item/<name>")
def item_image(name):
    if name in {"bookkeep.png", "footballsim.png", "nova.png", "quest.png",
                "novastrike.png", "pokemonadv.png", "freecell.png"}:
        return send_from_directory(IMG_DIR, "item_" + name)
    return jsonify(error="Not found."), 404

FIFA_DIR = GAMES_DIR / "football-sim" / "game"

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

@app.get("/play/nova")
def play_nova():
    return _nocache(send_from_directory(GAMES_DIR / "nova-blast", "index.html", max_age=0))

# ============================ 争上游 online rooms ============================
# Several phones at one table: the server holds the game and runs the house rules
# (same engine as the page: singles vs singles, pairs vs pairs, three-of-a-kind bomb,
# four-of-a-kind bigger bomb, both jokers beat all). Empty seats are computers.
# Rooms live in memory and vanish after two quiet hours.
import secrets as _secrets, time as _time, random as _random
ZSY_ROOMS, _zsy_lock = {}, threading.Lock()
ZSY_AI_NAMES = ["Grandma 🧓", "Uncle 👨", "Cousin 🧒", "Auntie 👩"]
ZSY_RANK = {3:"3",4:"4",5:"5",6:"6",7:"7",8:"8",9:"9",10:"10",11:"J",12:"Q",13:"K",14:"A",15:"2",16:"small joker",17:"big joker"}
ZSY_POWER = {"single":0,"pair":0,"bomb3":1,"bomb4":2,"jokers":3}

def zsy_deck():
    d, i = [], 0
    for r in range(3, 16):
        for s in "♠♥♣♦": d.append({"id": i, "r": r, "s": s}); i += 1
    d += [{"id": i, "r": 16, "s": "sj"}, {"id": i + 1, "r": 17, "s": "bj"}]
    return d
def zsy_classify(cards):
    if not cards: return None
    rs = [c["r"] for c in cards]
    if len(cards) == 2 and 16 in rs and 17 in rs: return {"type": "jokers", "r": 99, "cards": cards}
    if any(r != rs[0] for r in rs): return None
    t = {1: "single", 2: "pair", 3: "bomb3", 4: "bomb4"}.get(len(cards))
    return {"type": t, "r": rs[0], "cards": cards} if t else None
def zsy_beats(p, top):
    if not top or p["type"] == "jokers": return True
    if ZSY_POWER[p["type"]] > ZSY_POWER[top["type"]]: return True
    return p["type"] == top["type"] and p["r"] > top["r"]
def zsy_describe(p):
    n = ZSY_RANK.get(p["r"], "")
    return {"jokers": "🃏🃏 Joker bomb!", "bomb4": f"💣 Four {n}s — bomb!", "bomb3": f"💣 Three {n}s — bomb!", "pair": f"Pair of {n}s"}.get(p["type"], n)
def zsy_bombs_in(hand):
    g = {}
    for c in hand: g[c["r"]] = g.get(c["r"], 0) + 1
    return sum(1 for n in g.values() if n >= 3) + (1 if g.get(16) and g.get(17) else 0)
def zsy_groups(hand):
    g = {}
    for c in sorted(hand, key=lambda c: c["r"]): g.setdefault(c["r"], []).append(c)
    return [{"r": r, "cards": cs} for r, cs in sorted(g.items())]
def zsy_ai(hand, top, threat):
    gs = zsy_groups(hand); jok = [c for c in hand if c["r"] >= 16]; opts = []
    for g in gs:
        n = len(g["cards"])
        if n >= 3: opts.append({"type": "bomb4" if n >= 4 else "bomb3", "r": g["r"], "cards": g["cards"][:4 if n >= 4 else 3], "bomb": True})
        if n >= 2 and g["r"] < 16: opts.append({"type": "pair", "r": g["r"], "cards": g["cards"][:2], "breaks": n > 2})
        opts.append({"type": "single", "r": g["r"], "cards": [g["cards"][0]], "breaks": n > 1})
    if len(jok) == 2: opts.append({"type": "jokers", "r": 99, "cards": jok, "bomb": True})
    if not top:
        if len(gs) == 1: return zsy_classify(gs[0]["cards"]) or {"type": "single", "r": gs[0]["r"], "cards": gs[0]["cards"][:1]}
        whole = sorted([o for o in opts if not o.get("breaks") and not o.get("bomb")], key=lambda o: (o["r"], -len(o["cards"])))
        return whole[0] if whole else sorted([o for o in opts if not o.get("bomb")], key=lambda o: o["r"])[0] if any(not o.get("bomb") for o in opts) else opts[0]
    same = sorted([o for o in opts if o["type"] == top["type"] and not o.get("bomb") and o["r"] > top["r"]], key=lambda o: (o["r"], 1 if o.get("breaks") else 0))
    nb = [o for o in same if not o.get("breaks")]
    pick = nb[0] if nb else (same[0] if same and (len(hand) <= 4 or threat) else None)
    if pick and pick["r"] >= 15 and len(hand) > 6 and not threat and _random.random() < .5: pick = None
    if not pick:
        bombs = sorted([o for o in opts if o.get("bomb") and zsy_beats(o, top)], key=lambda o: (ZSY_POWER[o["type"]], o["r"]))
        if bombs and (threat or len(hand) <= 5 or (top["r"] >= 15 and _random.random() < .35)): pick = bombs[0]
    return pick

def _zsy_code():
    while True:
        c = "".join(_secrets.choice("ABCDEFGHJKMNPQRSTUVWXYZ23456789") for _ in range(4))
        if c not in ZSY_ROOMS: return c
def _zsy_room(code):
    r = ZSY_ROOMS.get((code or "").upper())
    if r and _time.time() - r["touched"] > 2 * 3600: ZSY_ROOMS.pop(code.upper(), None); return None
    return r
def _zsy_bump(r, msg=None):
    r["version"] += 1; r["touched"] = _time.time()
    if msg: r["log"] = (r["log"] + [msg])[-8:]
def _zsy_active(r): return [i for i, p in enumerate(r["players"]) if p["rank"] is None]
def _zsy_next(r):
    while True:
        r["turn"] = (r["turn"] + 1) % len(r["players"])
        if r["players"][r["turn"]]["rank"] is None: return
def zsy_deal(r):
    n = len(r["players"]); tries = 0
    while True:
        deck = zsy_deck(); _random.SystemRandom().shuffle(deck)
        each = min(18, len(deck) // n); extra = min(18 * n, len(deck)) - each * n; k = 0
        for i, p in enumerate(r["players"]):
            m = each + (1 if i < extra else 0); p["hand"] = sorted(deck[k:k + m], key=lambda c: (c["r"], c["s"])); k += m; p["rank"] = None
        tries += 1
        if not any(zsy_bombs_in(p["hand"]) >= 3 for p in r["players"]) or tries >= 40: break
    r["set_aside"] = len(deck) - k
    r.update(top=None, top_by=-1, passes=0, finished=[], status="play", turn=r.get("round_leader", 0) % n, ai_due=_time.time() + 1.2)
    _zsy_bump(r, f"{r['players'][r['turn']]['name']} leads.")
def zsy_apply_play(r, i, p):
    pl = r["players"][i]; ids = {c["id"] for c in p["cards"]}
    pl["hand"] = [c for c in pl["hand"] if c["id"] not in ids]
    r["top"], r["top_by"], r["passes"] = {"type": p["type"], "r": p["r"], "cards": p["cards"]}, i, 0
    msg = f"{pl['name']}: {zsy_describe(p)}"
    if not pl["hand"]:
        pl["rank"] = len(r["finished"]) + 1; r["finished"].append(i); msg += f" — out, #{pl['rank']}!"
        if len(_zsy_active(r)) == 1:
            last = _zsy_active(r)[0]; r["players"][last]["rank"] = len(r["finished"]) + 1; r["finished"].append(last)
            r["status"] = "over"; r["round_leader"] = r["finished"][0]; _zsy_bump(r, msg); return
    _zsy_next(r); r["ai_due"] = _time.time() + 1.0; _zsy_bump(r, msg)
def zsy_apply_pass(r, i):
    r["passes"] += 1; _zsy_next(r); msg = f"{r['players'][i]['name']}: pass"
    still_in = r["players"][r["top_by"]]["rank"] is None
    if r["turn"] == r["top_by"] or r["passes"] >= len(_zsy_active(r)) - (1 if still_in else 0):
        r["top"], r["passes"] = None, 0
        if still_in: r["turn"] = r["top_by"]
        msg += f" · {r['players'][r['turn']]['name']} leads."
    r["ai_due"] = _time.time() + 1.0; _zsy_bump(r, msg)
def zsy_run_ai(r):
    """Computers move on their own clock; called whenever anyone looks at the room."""
    moved = False
    while r["status"] == "play" and not r["players"][r["turn"]]["human"] and _time.time() >= r.get("ai_due", 0):
        i = r["turn"]; pl = r["players"][i]
        threat = any(p["rank"] is None and len(p["hand"]) <= 2 for j, p in enumerate(r["players"]) if j != i)
        p = zsy_ai(pl["hand"], r["top"], threat)
        if p: zsy_apply_play(r, i, {"type": p["type"], "r": p["r"], "cards": p["cards"]})
        else: zsy_apply_pass(r, i)
        moved = True
    return moved
def zsy_view(r, me):
    return {"code": r["code"], "status": r["status"], "version": r["version"], "turn": r["turn"], "you": me, "host": r["host"] == me,
            "seats": r["seats"], "set_aside": r.get("set_aside", 0), "log": r["log"],
            "players": [{"name": p["name"], "human": p["human"], "online": p["human"] and _time.time() - p.get("seen", 0) < 25,
                         "count": len(p["hand"]), "rank": p["rank"], "hand": p["hand"] if i == me else None} for i, p in enumerate(r["players"])],
            "top": r["top"], "top_by": r["top_by"]}

def _zsy_auth(code):
    r = _zsy_room(code)
    if not r: return None, None, (jsonify(error="That room is gone. Make a new one."), 404)
    x = request.get_json(silent=True) or {}
    pid, tok = request.args.get("player", x.get("player")), request.args.get("token", x.get("token"))
    try: i = int(pid)
    except (TypeError, ValueError): return r, None, (jsonify(error="Who are you? Join the room first."), 401)
    if not (0 <= i < len(r["players"])) or r["players"][i].get("token") != tok: return r, None, (jsonify(error="That seat isn't yours."), 403)
    r["players"][i]["seen"] = _time.time(); return r, i, None

@app.post("/api/zsy/rooms")
def zsy_create():
    x = request.get_json(silent=True) or {}
    name = (str(x.get("name") or "").strip() or session.get("v_name") or "Host")[:14]
    try: seats = max(2, min(5, int(x.get("seats") or 4)))
    except (TypeError, ValueError): seats = 4
    with _zsy_lock:
        if sum(1 for r in ZSY_ROOMS.values() if _time.time() - r["touched"] < 2 * 3600) > 200: return jsonify(error="Too many tables open right now."), 429
        code = _zsy_code(); tok = _secrets.token_urlsafe(12)
        ZSY_ROOMS[code] = {"code": code, "seats": seats, "host": 0, "status": "lobby", "version": 1, "touched": _time.time(), "log": [],
                           "players": [{"name": name, "human": True, "token": tok, "hand": [], "rank": None, "seen": _time.time()}],
                           "turn": 0, "top": None, "top_by": -1, "passes": 0, "finished": [], "round_leader": 0}
        r = ZSY_ROOMS[code]
    return jsonify(ok=True, code=code, player=0, token=tok, view=zsy_view(r, 0))
@app.post("/api/zsy/rooms/<code>/join")
def zsy_join(code):
    x = request.get_json(silent=True) or {}
    name = (str(x.get("name") or "").strip() or session.get("v_name") or "Player")[:14]
    with _zsy_lock:
        r = _zsy_room(code)
        if not r: return jsonify(error="No room with that code. Check the letters."), 404
        if r["status"] != "lobby": return jsonify(error="That game has already started. Ask the host for a new room."), 409
        if len(r["players"]) >= r["seats"]: return jsonify(error="That table is full."), 409
        tok = _secrets.token_urlsafe(12); i = len(r["players"])
        r["players"].append({"name": name, "human": True, "token": tok, "hand": [], "rank": None, "seen": _time.time()}); _zsy_bump(r, f"{name} joined.")
    return jsonify(ok=True, code=r["code"], player=i, token=tok, view=zsy_view(r, i))
@app.post("/api/zsy/rooms/<code>/start")
def zsy_start(code):
    with _zsy_lock:
        r, me, err = _zsy_auth(code)
        if err: return err
        if r["host"] != me: return jsonify(error="Only the host can start."), 403
        if r["status"] == "play": return jsonify(error="Already playing."), 409
        k = 0
        for p in r["players"]: p["hand"], p["rank"] = [], None
        while len(r["players"]) < r["seats"]:
            r["players"].append({"name": ZSY_AI_NAMES[k % 4], "human": False, "token": None, "hand": [], "rank": None}); k += 1
        zsy_deal(r)
    return jsonify(ok=True, view=zsy_view(r, me))
@app.post("/api/zsy/rooms/<code>/play")
def zsy_play(code):
    x = request.get_json(silent=True) or {}
    with _zsy_lock:
        r, me, err = _zsy_auth(code)
        if err: return err
        if r["status"] != "play" or r["turn"] != me: return jsonify(error="Not your turn."), 409
        ids = set(x.get("cards") or []); cards = [c for c in r["players"][me]["hand"] if c["id"] in ids]
        if len(cards) != len(ids): return jsonify(error="Those cards aren't in your hand."), 400
        p = zsy_classify(cards)
        if not p: return jsonify(error="Not a valid set: a single, a pair, three or four of a kind, or both jokers."), 400
        if not zsy_beats(p, r["top"]): return jsonify(error=f"That doesn't beat {zsy_describe(r['top'])}."), 400
        zsy_apply_play(r, me, p)
    return jsonify(ok=True, view=zsy_view(r, me))
@app.post("/api/zsy/rooms/<code>/pass")
def zsy_pass(code):
    with _zsy_lock:
        r, me, err = _zsy_auth(code)
        if err: return err
        if r["status"] != "play" or r["turn"] != me: return jsonify(error="Not your turn."), 409
        if not r["top"]: return jsonify(error="You lead — you have to play something."), 400
        zsy_apply_pass(r, me)
    return jsonify(ok=True, view=zsy_view(r, me))
@app.get("/api/zsy/rooms/<code>/state")
def zsy_state(code):
    """Long-poll: answers as soon as the room changes (or after 20 s). Computers move here."""
    try: since = int(request.args.get("v") or 0)
    except ValueError: since = 0
    deadline = _time.time() + 20
    while True:
        with _zsy_lock:
            r, me, err = _zsy_auth(code)
            if err: return err
            zsy_run_ai(r)
            if r["version"] != since or _time.time() >= deadline: return jsonify(ok=True, view=zsy_view(r, me))
            wait = max(0.15, min(0.5, r.get("ai_due", 0) - _time.time())) if r["status"] == "play" and not r["players"][r["turn"]]["human"] else 0.5
        _time.sleep(wait)

# ============================ News Tracker ====================================
# A small app: follow topics, see the latest headlines for each (Google News RSS,
# no key needed), keep track of what you have seen, save stories, and get a short
# AI summary of a topic's day. Per login, like BookKeep's books.
import xml.etree.ElementTree as _ET, email.utils as _eu, urllib.request as _ur, urllib.parse as _up
NEWS_DIR = APP_DIR.parent / "news-tracker"
NEWS_TTL = 15 * 60
NEWS_KEEP_DAYS = 3 * 365
NEWS_RECENT_DAYS = 3                     # newer than this = the live lists; older = the Past area                 # the app remembers three years of stories (Barbara, 2026-10-18)
NEWS_DEFAULT_TOPICS = ["3D printing", "Robotics", "Indie games", "Small business"]
# The big outlets' front pages, each filed under a category. WSJ and CNN keep no fresh
# public feed any more, so theirs come through Google News limited to their sites.
_G = lambda q: "https://news.google.com/rss/search?q=" + _up.quote(q) + "+when:1d&hl=en-US&gl=US&ceid=US:en"
NEWS_CATS = ["Top stories", "World", "US", "Business & Markets", "Technology"]
NEWS_PUBLISHERS = [
  # the day's biggest stories as Google News ranks them across every outlet (source = the outlet)
  {"name": "Top stories", "url": "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en", "cat": "Top stories", "keep_source": True},
  {"name": "Top stories", "url": "https://news.google.com/rss/headlines/section/topic/NATION?hl=en-US&gl=US&ceid=US:en", "cat": "Top stories", "keep_source": True},
  {"name": "Wall Street Journal", "url": _G("site:wsj.com"), "cat": "Business & Markets"},
  {"name": "CNN", "url": _G("site:cnn.com"), "cat": "US"},
  {"name": "Reuters", "url": _G("site:reuters.com"), "cat": "World"},
  {"name": "AP News", "url": _G("site:apnews.com"), "cat": "US"},
  {"name": "New York Times", "url": "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", "cat": "US"},
  {"name": "New York Times", "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "cat": "World"},
  {"name": "New York Times", "url": "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", "cat": "Business & Markets"},
  {"name": "New York Times", "url": "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", "cat": "Technology"},
  {"name": "BBC", "url": "https://feeds.bbci.co.uk/news/world/rss.xml", "cat": "World"},
  {"name": "BBC", "url": "https://feeds.bbci.co.uk/news/business/rss.xml", "cat": "Business & Markets"},
  {"name": "BBC", "url": "https://feeds.bbci.co.uk/news/technology/rss.xml", "cat": "Technology"},
  {"name": "Bloomberg", "url": "https://feeds.bloomberg.com/markets/news.rss", "cat": "Business & Markets"},
  {"name": "Bloomberg", "url": "https://feeds.bloomberg.com/technology/news.rss", "cat": "Technology"},
  {"name": "CNBC", "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", "cat": "Business & Markets"},
  {"name": "The Guardian", "url": "https://www.theguardian.com/world/rss", "cat": "World"},
  {"name": "Fox News", "url": "https://moxie.foxnews.com/google-publisher/latest.xml", "cat": "US"},
  {"name": "NPR", "url": "https://feeds.npr.org/1001/rss.xml", "cat": "US"},
]
NEWS_SECTIONS = {"top": "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
                 "technology": "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en",
                 "business": "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en",
                 "science": "https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=en-US&gl=US&ceid=US:en",
                 "sports": "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-US&gl=US&ceid=US:en",
                 "world": "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en"}
def _news_collector():
    """Every hour: refresh the front pages and every topic anyone follows, so the three-year memory keeps filling."""
    import time as _t
    _t.sleep(60)
    while True:
        try:
            with app.app_context():
                con = db(); topics = [r["topic"] for r in con.execute("SELECT DISTINCT topic FROM news_topics")]
                con.execute("DELETE FROM news_items WHERE published < ?", ((datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=NEWS_KEEP_DAYS)).isoformat(),))
                con.commit(); con.close()
                news_frontpages()
                for t in topics: news_items(t)
                con = db(); recent = [dict(r) for r in con.execute("SELECT link,title,source,snippet FROM news_items WHERE (snippet IS NULL OR snippet='') AND published >= ? ORDER BY published DESC LIMIT 400",
                                                                   ((datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=NEWS_RECENT_DAYS)).isoformat(),))]
                _attach_known_summaries(con, recent); con.close()
                for i in range(0, len(recent), 25):
                    with _sum_lock: news_fill_summaries(recent[i:i + 25], budget=25)
                news_precompute_details(150)
        except Exception as e:                                             # noqa: BLE001
            print("[news] collector:", e, flush=True)
        _t.sleep(3600)
if os.environ.get("NEWS_COLLECTOR", "1") != "0" and not os.environ.get("WERKZEUG_RUN_MAIN") == "false":
    threading.Thread(target=_news_collector, daemon=True, name="news-collector").start()
def news_user():
    em = (visitor() or session.get("email") or "").strip().lower()
    return "news_" + re.sub(r"[^a-z0-9]+", "_", em)[:60] if em else ("news_local" if is_local_request() else None)
NEWS_ALIASES = {"Breaking News, Latest News and Videos": "CNN", "CNN.com": "CNN", "The New York Times": "New York Times", "NYT": "New York Times", "NYTimes.com": "New York Times",
                "BBC News": "BBC", "BBC.com": "BBC", "The Wall Street Journal": "Wall Street Journal", "WSJ": "Wall Street Journal", "WSJ.com": "Wall Street Journal",
                "Bloomberg.com": "Bloomberg", "Bloomberg News": "Bloomberg", "Reuters.com": "Reuters", "AP": "AP News", "Associated Press": "AP News", "The Associated Press": "AP News",
                "Fox News Channel": "Fox News", "FOX News": "Fox News", "NPR.org": "NPR", "The Guardian US": "The Guardian", "Guardian": "The Guardian", "CNBC.com": "CNBC"}
def _news_fetch(url):
    req = _ur.Request(url, headers={"User-Agent": "Mozilla/5.0 (hardywu.com News Tracker)"})
    root = _ET.fromstring(_ur.urlopen(req, timeout=15).read())
    out = []
    for it in root.findall(".//item")[:40]:
        title = (it.findtext("title") or "").strip(); link = (it.findtext("link") or "").strip()
        src = it.find("{https://news.google.com/rss}source"); src = (src.text if src is not None else "")
        if not src and " - " in title: title, src = title.rsplit(" - ", 1)
        src = NEWS_ALIASES.get(src.strip(), src.strip())
        try: ts = _eu.parsedate_to_datetime(it.findtext("pubDate") or "").astimezone(datetime.timezone.utc).isoformat()
        except Exception: ts = ""
        desc = re.sub(r"<[^>]+>", " ", it.findtext("description") or ""); desc = re.sub(r"\s+", " ", desc).strip()
        if desc.startswith(title) or "news.google.com" in link: desc = ""      # Google's 'description' is a list of other headlines, not a summary
        out.append({"title": title, "link": link, "source": src.strip(), "published": ts, "snippet": desc[:220]})
    return out
def news_items(topic):
    """Headlines for a topic (a section name or free words), cached 15 minutes."""
    key = topic.strip().lower()
    con = db(); row = con.execute("SELECT fetched_at, items FROM news_cache WHERE topic=?", (key,)).fetchone()
    if row and (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(row["fetched_at"])).total_seconds() < NEWS_TTL:
        con.close(); return json.loads(row["items"]), row["fetched_at"]
    url = NEWS_SECTIONS.get(key) or ("https://news.google.com/rss/search?q=" + _up.quote(topic) + "&hl=en-US&gl=US&ceid=US:en")
    try: items = _news_fetch(url)
    except Exception as e:                                             # noqa: BLE001
        con.close(); print("[news] fetch failed", topic, e, flush=True)
        return (json.loads(row["items"]) if row else []), (row["fetched_at"] if row else None)
    now = now_iso(); con.execute("INSERT OR REPLACE INTO news_cache(topic,fetched_at,items) VALUES(?,?,?)", (key, now, json.dumps(items)))
    _news_remember(con, key, items); con.commit(); con.close()
    return items, now
def _news_remember(con, topic, items, category=None):
    for it in items:
        if it.get("link"):
            con.execute("""INSERT OR IGNORE INTO news_items(link,title,source,category,topic,published,snippet,first_seen) VALUES(?,?,?,?,?,?,?,?)""",
                        (it["link"], it["title"], it.get("source", ""), category or "", topic, it.get("published") or now_iso(), it.get("snippet", ""), now_iso()))
def _news_history(con, topic, days, cap):
    since = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)).isoformat()
    return [dict(r) for r in con.execute("SELECT link,title,source,category,published,snippet FROM news_items WHERE topic=? AND published>=? ORDER BY published DESC LIMIT ?", (topic, since, cap))]
def _story_key(it):
    """The same article often shows up under two addresses; same outlet + same headline = one story."""
    t = re.sub(r"[^a-z0-9 ]+", "", (it.get("title") or "").lower()); t = re.sub(r"\s+", " ", t).strip()
    return ((it.get("source") or "").lower().strip(), t[:120])
_TITLE_STOP = set("the a an and or of to in on at for with from by as is are was were be been has have had will would could says said after amid over into about its their his her this that new more than".split())
def _title_tokens(t):
    return {w for w in re.findall(r"[a-z0-9]+", (t or "").lower()) if len(w) > 2 and w not in _TITLE_STOP}
def _same_story(a, b):
    """Two headlines about the same event, from any outlets: enough of the meaningful words overlap."""
    if not a or not b: return False
    inter = len(a & b); small = min(len(a), len(b))
    return (inter >= 4 and inter / small >= 0.6) or (inter >= 3 and inter / len(a | b) >= 0.6)
def _merge(fresh, hist, cap):
    """Newest first; the same article under two addresses shows once, and the same event reported by
    several outlets becomes ONE story with the others listed under it ('also')."""
    seen, keys, out = set(), set(), []
    for it in sorted(fresh + hist, key=lambda i: i.get("published") or "", reverse=True):
        k = _story_key(it)
        if it["link"] in seen or k in keys: continue
        seen.add(it["link"]); keys.add(k)
        it["source"] = NEWS_ALIASES.get((it.get("source") or "").strip(), (it.get("source") or "").strip())
        toks = _title_tokens(it.get("title"))
        home = next((o for o in out if _same_story(o["_toks"], toks)), None)
        if home is not None:
            if it.get("source") and it["source"] != home.get("source") and all(a["source"] != it["source"] for a in home["also"]):
                home["also"].append({"source": it["source"], "link": it["link"], "title": it["title"], "published": it.get("published")})
            continue                                   # never borrow a summary from a merged neighbour
        it = dict(it); it["_toks"] = toks; it["also"] = []; out.append(it)
        if len(out) >= cap: break
    for o in out: o.pop("_toks", None)
    return out
def news_frontpages():
    """Every publisher's latest, filed by category; remembers a week."""
    import concurrent.futures as _cf
    cats = {c: [] for c in NEWS_CATS}; stamps = []
    con = db(); stale = []
    for pub in NEWS_PUBLISHERS:
        key = "pub:" + pub["name"] + ":" + pub["cat"]
        row = con.execute("SELECT fetched_at, items FROM news_cache WHERE topic=?", (key,)).fetchone()
        if row and (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(row["fetched_at"])).total_seconds() < NEWS_TTL:
            cats[pub["cat"]].extend(json.loads(row["items"])); stamps.append(row["fetched_at"])
        else: stale.append((pub, key, json.loads(row["items"]) if row else []))
    def grab(entry):                                   # all the stale feeds at once, not one after another
        pub, key, old = entry
        try: items = _news_fetch(pub["url"])[:30]
        except Exception as e:                                            # noqa: BLE001
            print("[news] publisher failed", pub["name"], e, flush=True); items = old
        for it in items:
            if not pub.get("keep_source") or not it.get("source"): it["source"] = pub["name"]
            it["category"] = pub["cat"]
        return pub, key, items
    if stale:
        with _cf.ThreadPoolExecutor(min(8, len(stale))) as ex: results = list(ex.map(grab, stale))
        now = now_iso()
        for pub, key, items in results:
            stamps.append(now); cats[pub["cat"]].extend(items)
            con.execute("INSERT OR REPLACE INTO news_cache(topic,fetched_at,items) VALUES(?,?,?)", (key, now, json.dumps(items)))
            _news_remember(con, "front:" + pub["cat"], items, pub["cat"])
    con.commit()
    out = {c: _merge(cats[c], _news_history(con, "front:" + c, NEWS_RECENT_DAYS + 1, 300), 120) for c in NEWS_CATS}   # live lists: the last few days; older lives in Past
    con.close()
    return out, (max(stamps) if stamps else None)
# ---- summaries: the line under each headline. 1) the publisher's feed text; 2) else resolve the
# real article (Google links are wrappers) and read the page's own description line;
# 3) else one plain sentence written by the AI from the headline — marked as such.
def _page_summary(url):
    try:
        req = _ur.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36", "Accept": "text/html"})
        page = _ur.urlopen(req, timeout=8).read(300000).decode("utf-8", "ignore")
    except Exception: return None                                                   # noqa: BLE001
    for pat in (r'<meta[^>]+property="og:description"[^>]+content="([^"]{25,})"', r'<meta[^>]+content="([^"]{25,})"[^>]+property="og:description"',
                r'<meta[^>]+name="description"[^>]+content="([^"]{25,})"', r'<meta[^>]+content="([^"]{25,})"[^>]+name="description"',
                r'<meta[^>]+name="twitter:description"[^>]+content="([^"]{25,})"'):
        m = re.search(pat, page, re.I)
        if m:
            t = html.unescape(m.group(1)).strip(); t = re.sub(r"\s+", " ", t)
            if len(t) > 25 and not re.match(r"(?i)(subscribe|sign up|read the latest|breaking news|get the latest)", t): return t[:300]
    # no description line: the article's own first real paragraph
    page2 = re.sub(r"(?is)<(script|style|noscript|svg|header|footer|nav|aside)[^>]*>.*?</\1>", " ", page)
    for m in re.findall(r"(?is)<p[^>]*>(.*?)</p>", page2):
        t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", m))).strip()
        if len(t) > 80 and not re.search(r"(?i)subscribe|sign up|cookies|newsletter|all rights reserved|read more|advertisement", t):
            t = t[:300]; cut = t.rfind(". ", 120, 260)
            return (t[:cut + 1] if cut > 0 else t)
    return None
def _ai_summaries(items):
    """One sentence each, from the headline and the other outlets' headlines on the same event. Batched."""
    if not os.environ.get("OPENAI_API_KEY") or not items: return {}
    lines = "\n".join(f"{i+1}. {it['title']} ({it.get('source','')})" + (" | also: " + "; ".join(a['title'] for a in it.get('also', [])[:3]) if it.get('also') else "") for i, it in enumerate(items))
    try:
        from openai import OpenAI
        r = OpenAI().chat.completions.create(model=os.environ.get("OPENAI_MODEL", "gpt-5.1"), max_completion_tokens=60 * len(items) + 50,
            messages=[{"role": "system", "content": "For each numbered headline write ONE plain sentence (max 28 words) saying what the story is about, using only what the headline(s) say — never add facts. Output exactly one line per item as 'N. sentence'."},
                      {"role": "user", "content": lines}])
        out = {}
        for ln in r.choices[0].message.content.splitlines():
            m = re.match(r"\s*(\d+)[.)]\s*(.+)", ln)
            if m and 1 <= int(m.group(1)) <= len(items): out[items[int(m.group(1)) - 1]["link"]] = m.group(2).strip()[:300]
        return out
    except Exception as e:                                                         # noqa: BLE001
        print("[news] ai summaries:", e, flush=True); return {}
_sum_lock = threading.Lock()
def news_fill_summaries(items, budget=25):
    """Fill the missing summary lines for these items (bounded), remembering each in news_links."""
    import concurrent.futures as _cf
    todo = [it for it in items if not it.get("snippet")][:budget]
    if not todo: return 0
    con = db()
    known = {r["link"]: dict(r) for r in con.execute(f"SELECT * FROM news_links WHERE link IN ({','.join('?'*len(todo))})", [it["link"] for it in todo])}
    for it in todo:
        k = known.get(it["link"])
        if k and k.get("summary"): it["snippet"], it["summary_src"] = k["summary"], k["summary_src"]
    todo = [it for it in todo if not it.get("snippet") and not (known.get(it["link"]) or {}).get("tried_at")]
    if not todo: con.close(); return 0
    # 1) real article addresses (Google links decoded in one call), then the pages' own description lines
    gl = [it for it in todo if "news.google.com" in it["link"]]
    real = {it["link"]: it["link"] for it in todo if it not in gl}
    if gl:
        try:
            from googlenewsdecoder import gnewsdecoder
            res = gnewsdecoder([it["link"] for it in gl], interval=0)
            for it, r in zip(gl, res if isinstance(res, list) else [res]):
                if isinstance(r, dict) and r.get("success") and r.get("decoded_url"): real[it["link"]] = r["decoded_url"]
        except Exception as e:                                                     # noqa: BLE001
            print("[news] decode:", e, flush=True)
    with _cf.ThreadPoolExecutor(8) as ex:
        got = dict(zip([it["link"] for it in todo], ex.map(lambda it: _page_summary(real[it["link"]]) if real.get(it["link"]) else None, todo)))
    for it in todo:
        if got.get(it["link"]): it["snippet"], it["summary_src"] = got[it["link"]], "page"
    # 2) the rest: one honest sentence from the headline
    rest = [it for it in todo if not it.get("snippet")]
    ai = _ai_summaries(rest)
    for it in rest:
        if ai.get(it["link"]): it["snippet"], it["summary_src"] = ai[it["link"]], "ai"
    now = now_iso()
    for it in todo:
        con.execute("INSERT OR REPLACE INTO news_links(link,real_url,summary,summary_src,tried_at) VALUES(?,?,?,?,?)",
                    (it["link"], real.get(it["link"]), it.get("snippet") or None, it.get("summary_src"), now))
        if it.get("snippet"): con.execute("UPDATE news_items SET snippet=? WHERE link=? AND (snippet IS NULL OR snippet='')", (it["snippet"], it["link"]))
    con.commit(); con.close()
    return sum(1 for it in todo if it.get("snippet"))
def _attach_known_summaries(con, items):
    """Stories already summarised earlier get their line back without any fetching."""
    missing = [it for it in items if not it.get("snippet")]
    if not missing: return
    rows = {r["link"]: r for r in con.execute(f"SELECT link,summary,summary_src FROM news_links WHERE summary IS NOT NULL AND link IN ({','.join('?'*len(missing))})", [it["link"] for it in missing])}
    for it in missing:
        r = rows.get(it["link"])
        if r: it["snippet"], it["summary_src"] = r["summary"], r["summary_src"]
@app.post("/api/news/click")
def news_click():
    """A headline was tapped — counts toward the leaderboard."""
    u = news_user()
    if not u: return jsonify(error="Please sign in."), 401
    link = str((request.get_json(silent=True) or {}).get("link") or "")[:2000]
    if link:
        con = db(); con.execute("INSERT INTO news_clicks(link,user_key,at) VALUES(?,?,?)", (link, u, now_iso())); con.commit(); con.close()
    return jsonify(ok=True)
_HOT_SKIP = {"The", "New", "US", "U.S", "Why", "How", "What", "When", "Where", "Who", "Live", "Breaking", "Watch", "Video", "Opinion", "Exclusive", "Analysis", "Explainer", "Review", "Update", "Updates", "Report", "Photos", "Everything", "Inside", "First", "Latest", "Your", "This", "That", "These", "After", "Before", "With", "Says", "Said", "From", "Over", "Into", "About", "Amid", "Against", "Will", "Could", "Would", "Should", "Can", "Not", "But", "And", "For", "Its", "His", "Her", "Their"}
@app.get("/api/news/popular")
def news_popular():
    """The leaderboard: the stories most outlets are reporting and most readers here are opening or saving."""
    u = news_user()
    if not u: return jsonify(error="Please sign in."), 401
    try: days = max(1, min(30, int(request.args.get("days") or NEWS_RECENT_DAYS)))
    except ValueError: days = NEWS_RECENT_DAYS
    since = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)).isoformat()
    con = db()
    rows = [dict(r) for r in con.execute("SELECT link,title,source,category,topic,published,snippet FROM news_items WHERE published >= ? AND topic LIKE 'front:%' ORDER BY published DESC LIMIT 1500", (since,))]
    clicks = {r["link"]: r["n"] for r in con.execute("SELECT link, COUNT(*) AS n FROM news_clicks WHERE at >= ? GROUP BY link", (since,))}
    saves = {r["link"]: r["n"] for r in con.execute("SELECT link, COUNT(*) AS n FROM news_saved WHERE saved_at >= ? GROUP BY link", (since,))}
    seen = {r["link"] for r in con.execute("SELECT link FROM news_seen WHERE user_key=?", (u,))}
    saved_mine = {r["link"] for r in con.execute("SELECT link FROM news_saved WHERE user_key=?", (u,))}
    stories = _merge(rows, [], 1500)
    _attach_known_summaries(con, stories); con.close()
    out = []
    for it in stories:
        links = [it["link"]] + [a["link"] for a in it.get("also", [])]
        outlets = 1 + len(it.get("also", [])); c = sum(clicks.get(l, 0) for l in links); sv = sum(saves.get(l, 0) for l in links)
        score = outlets * 3 + c * 2 + sv * 5
        if outlets < 2 and not c and not sv: continue
        it.update(outlets=outlets, clicks=c, saves=sv, score=score, seen=it["link"] in seen, saved=it["link"] in saved_mine)
        out.append(it)
    out.sort(key=lambda i: (-i["score"], i.get("published") or ""), reverse=False)
    # topics: the subjects people follow here, ranked by how much is being written and opened
    con = db()
    topic_names = [r["topic"] for r in con.execute("SELECT topic, COUNT(*) AS n FROM news_topics GROUP BY topic ORDER BY n DESC LIMIT 40")]
    topics = []
    for t in topic_names:
        n = con.execute("SELECT COUNT(*) FROM news_items WHERE topic=? AND published >= ?", (t.lower(), since)).fetchone()[0]
        c = con.execute("SELECT COUNT(*) FROM news_clicks k JOIN news_items i ON i.link=k.link WHERE i.topic=? AND k.at >= ?", (t.lower(), since)).fetchone()[0]
        followers = con.execute("SELECT COUNT(*) FROM news_topics WHERE topic=? COLLATE NOCASE", (t,)).fetchone()[0]
        if n: topics.append({"topic": t, "stories": n, "clicks": c, "followers": followers, "score": n + c * 3 + followers * 2})
    topics.sort(key=lambda x: -x["score"])
    con.close()
    # hot subjects: names and phrases that keep appearing across this period's headlines
    phrases = {}
    for it in stories:
        heads = [it["title"]] + [a["title"] for a in it.get("also", [])]
        found = set()
        for h in heads:
            for m in re.finditer(r"\b([A-Z][a-zA-Z'’.-]+(?:\s+(?:of|the|de|van|von|al)?\s*[A-Z][a-zA-Z'’.-]+){0,2})", h or ""):
                ph = re.sub(r"[’']s$", "", m.group(1).strip(" .'’"))      # Trump’s → Trump
                if len(ph) < 4 or ph.lower() in _TITLE_STOP or ph in _HOT_SKIP or re.fullmatch(r"(Here|There|Just|Today|Tonight|Yesterday|Tomorrow|Billion|Million|Trillion|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)", ph): continue
                found.add(ph)
        for ph in found: phrases[ph] = phrases.get(ph, 0) + 1
    hot = [{"subject": k, "stories": v} for k, v in phrases.items() if v >= 2]
    hot.sort(key=lambda x: (-x["stories"], x["subject"]))
    return jsonify(ok=True, days=days, items=out[:30], topics=topics[:15], hot=hot[:20])
def _article_text(url):
    """The readable paragraphs of an article page (best effort; paywalls give little)."""
    try:
        req = _ur.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36", "Accept": "text/html"})
        page = _ur.urlopen(req, timeout=10).read(600000).decode("utf-8", "ignore")
    except Exception: return ""                                                    # noqa: BLE001
    page = re.sub(r"(?is)<(script|style|noscript|svg|header|footer|nav|aside)[^>]*>.*?</\1>", " ", page)
    paras = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", m))).strip() for m in re.findall(r"(?is)<p[^>]*>(.*?)</p>", page)]
    paras = [t for t in paras if len(t) > 60 and not re.search(r"(?i)subscribe|sign up|cookies|newsletter|all rights reserved|read more", t)]
    return "\n".join(paras)[:7000]
def make_detail(link, alts=()):
    """Five sentences for one story: from the article (Google links resolved), else another outlet's copy, else the headline. Cached."""
    con = db()
    row = con.execute("SELECT text, src FROM news_details WHERE link=?", (link,)).fetchone()
    if row: con.close(); return row["text"], row["src"], True
    it = con.execute("SELECT link,title,source,snippet,published FROM news_items WHERE link=?", (link,)).fetchone()
    if not it: con.close(); raise LookupError("I don't have that story.")
    it = dict(it); lk = con.execute("SELECT real_url, summary FROM news_links WHERE link=?", (link,)).fetchone()
    con.close()
    real = (lk["real_url"] if lk and lk["real_url"] else None)
    if not real and "news.google.com" in link:
        try:
            from googlenewsdecoder import gnewsdecoder
            r = gnewsdecoder(link, interval=0); real = r.get("decoded_url") if isinstance(r, dict) and r.get("success") else None
        except Exception: real = None                                              # noqa: BLE001
    if not real and "news.google.com" not in link: real = link
    body = _article_text(real) if real else ""
    read_from = it.get("source", "")
    alts = [a for a in alts if a and a != link][:4]
    if len(body) <= 400 and alts:                                       # try another outlet's version of the same story
        try:
            from googlenewsdecoder import gnewsdecoder
            g = [a for a in alts if "news.google.com" in a]; real_alts = {a: a for a in alts if a not in g}
            if g:
                res = gnewsdecoder(g, interval=0)
                for a, r in zip(g, res if isinstance(res, list) else [res]):
                    if isinstance(r, dict) and r.get("success") and r.get("decoded_url"): real_alts[a] = r["decoded_url"]
        except Exception: real_alts = {a: a for a in alts if "news.google.com" not in a}   # noqa: BLE001
        con = db()
        for a in alts:
            u = real_alts.get(a)
            if not u: continue
            t = _article_text(u)
            if len(t) > 400:
                body = t; srcrow = con.execute("SELECT source FROM news_items WHERE link=?", (a,)).fetchone(); read_from = (srcrow["source"] if srcrow else "") or _up.urlparse(u).hostname; break
        con.close()
    if not os.environ.get("OPENAI_API_KEY"): raise RuntimeError("The detail needs the AI key on the server.")
    src = "article" if len(body) > 400 else "headline"
    context = (f"Article text:\n{body}" if src == "article" else f"Only the headline and summary are available (the article could not be read):\nHeadline: {it['title']}\nSummary: {it.get('snippet') or (lk and lk['summary']) or ''}")
    from openai import OpenAI
    r = OpenAI().chat.completions.create(model=os.environ.get("OPENAI_MODEL", "gpt-5.1"), max_completion_tokens=320,
        messages=[{"role": "system", "content": "Explain what happened in exactly five plain sentences for a busy parent: who, what, where, when, why it matters. Use only the material given; never invent names, numbers or quotes. If only a headline is available, say what is known and that details are thin. No bullet points, no headings."},
                  {"role": "user", "content": f"Headline: {it['title']} ({it.get('source','')}, {str(it.get('published') or '')[:10]})\n{context}"}])
    text = r.choices[0].message.content.strip()
    src_label = f"article:{read_from}" if src == "article" else "headline"
    con = db(); con.execute("INSERT OR REPLACE INTO news_details(link,text,src,made_at) VALUES(?,?,?,?)", (link, text, src_label, now_iso())); con.commit(); con.close()
    return text, src_label, False
@app.post("/api/news/detail")
def news_detail():
    """The arrow under a summary. Usually already made in the background; otherwise made now."""
    if not news_user(): return jsonify(error="Please sign in."), 401
    x = request.get_json(silent=True) or {}
    link = str(x.get("link") or "")[:2000]; alts = [str(l)[:2000] for l in (x.get("also") or [])][:4]
    try: text, src, cached = make_detail(link, alts)
    except LookupError as e: return jsonify(error=str(e)), 404
    except RuntimeError as e: return jsonify(error=str(e)), 503
    except Exception as e: return jsonify(error=f"The detail didn't come through ({type(e).__name__})."), 502     # noqa: BLE001
    return jsonify(ok=True, text=text, src=src, cached=cached)
_detail_lock = threading.Lock()
def news_precompute_details(limit=150):
    """Read ahead: make the five-sentence detail for the stories readers will see next (front pages first, then topics), newest first."""
    if not os.environ.get("OPENAI_API_KEY") or not _detail_lock.acquire(blocking=False): return 0
    made = 0
    try:
        front, _ = news_frontpages()
        queue = [it for c in NEWS_CATS for it in front[c][:40]]
        con = db(); topics = [r["topic"] for r in con.execute("SELECT topic, COUNT(*) n FROM news_topics GROUP BY topic ORDER BY n DESC LIMIT 20")]
        have = {r["link"] for r in con.execute("SELECT link FROM news_details")}; con.close()
        for t in topics:
            items, _ = news_items(t); con = db(); items = _merge(items, _news_history(con, t.strip().lower(), NEWS_RECENT_DAYS, 200), 40); con.close(); queue += items
        seen = set()
        for it in queue:
            if made >= limit: break
            if it["link"] in have or it["link"] in seen: continue
            seen.add(it["link"])
            try: make_detail(it["link"], [a["link"] for a in it.get("also", [])]); made += 1
            except Exception as e: print("[news] detail:", type(e).__name__, flush=True)   # noqa: BLE001
    finally: _detail_lock.release()
    return made
def _news_details_once():
    import time as _t; _t.sleep(5); n = news_precompute_details(300); print(f"[news] read ahead: {n} details made", flush=True)
threading.Thread(target=_news_details_once, daemon=True, name="news-details-once").start()
@app.post("/api/news/summaries")
def news_summaries_api():
    """The page asks for the lines it is still missing; answers with what it could get (bounded per call)."""
    if not news_user(): return jsonify(error="Please sign in."), 401
    x = request.get_json(silent=True) or {}
    links = [str(l)[:2000] for l in (x.get("links") or [])][:40]
    con = db(); rows = [dict(r) for r in con.execute(f"SELECT link,title,source,snippet FROM news_items WHERE link IN ({','.join('?'*len(links))})", links)] if links else []
    _attach_known_summaries(con, rows); con.close()
    with _sum_lock: news_fill_summaries(rows, budget=25)
    return jsonify(ok=True, summaries={r["link"]: {"text": r["snippet"], "src": r.get("summary_src", "feed")} for r in rows if r.get("snippet")})
def _news_topics(con, u):
    rows = [r["topic"] for r in con.execute("SELECT topic FROM news_topics WHERE user_key=? ORDER BY position, created_at", (u,))]
    if not rows:
        for i, t in enumerate(NEWS_DEFAULT_TOPICS): con.execute("INSERT INTO news_topics(user_key,topic,position,created_at) VALUES(?,?,?,?)", (u, t, i, now_iso()))
        con.commit(); rows = list(NEWS_DEFAULT_TOPICS)
    return rows
@app.get("/news")
def news_page():
    return _nocache(send_from_directory(NEWS_DIR, "index.html", max_age=0))
@app.get("/api/news/home")
def news_home():
    u = news_user()
    if not u: return jsonify(error="Please sign in."), 401
    con = db(); topics = _news_topics(con, u)
    seen = {r["link"] for r in con.execute("SELECT link FROM news_seen WHERE user_key=?", (u,))}
    saved = {r["link"]: dict(r) for r in con.execute("SELECT * FROM news_saved WHERE user_key=? ORDER BY saved_at DESC", (u,))}
    con.close()
    import concurrent.futures as _cf
    with _cf.ThreadPoolExecutor(min(6, max(1, len(topics)))) as ex: fetched = list(ex.map(news_items, topics))
    out = []
    for t, (items, at) in zip(topics, fetched):
        con = db(); items = _merge(items, _news_history(con, t.strip().lower(), NEWS_KEEP_DAYS, 400), 150); con.close()
        cutoff = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=NEWS_RECENT_DAYS)).isoformat()
        recent = [it for it in items if (it.get("published") or "") >= cutoff]
        con = db(); _attach_known_summaries(con, recent); con.close()
        for it in recent: it["seen"] = it["link"] in seen; it["saved"] = it["link"] in saved
        con = db(); older = con.execute("SELECT COUNT(*) FROM news_items WHERE topic=? AND published < ?", (t.strip().lower(), cutoff)).fetchone()[0]; con.close()
        out.append({"topic": t, "fetched_at": at, "items": recent, "older": older, "new": sum(1 for it in recent if not it["seen"])})
    front, fat = news_frontpages()
    cutoff = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=NEWS_RECENT_DAYS)).isoformat()
    con = db(); older_by_cat = {c: con.execute("SELECT COUNT(*) FROM news_items WHERE topic=? AND published < ?", ("front:" + c, cutoff)).fetchone()[0] for c in NEWS_CATS}; con.close()
    placed = []                                       # a story shows in the first category it belongs to, never twice
    for c in NEWS_CATS:
        kept = []
        for it in front[c]:
            if (it.get("published") or "") < cutoff: continue
            toks = _title_tokens(it.get("title"))
            home = next((o for o in placed if o["link"] == it["link"] or _same_story(o["_toks"], toks)), None)
            if home is not None:
                for a in [{"source": it.get("source"), "link": it["link"], "title": it["title"], "published": it.get("published")}] + it.get("also", []):
                    if a["source"] and a["source"] != home.get("source") and all(x["source"] != a["source"] for x in home["also"]): home["also"].append(a)
                continue
            it["_toks"] = toks; placed.append(it); kept.append(it)
        front[c] = kept
    for it in placed: it.pop("_toks", None)
    con = db(); _attach_known_summaries(con, placed); con.close()
    for c in front:
        for it in front[c]: it["seen"] = it["link"] in seen; it["saved"] = it["link"] in saved
    return jsonify(user=u, name=session.get("v_name") or session.get("name") or "", topics=out, saved=list(saved.values()), sections=list(NEWS_SECTIONS),
                   front={"fetched_at": fat, "categories": [{"name": c, "items": front[c], "older": older_by_cat[c], "new": sum(1 for it in front[c] if not it["seen"])} for c in NEWS_CATS],
                          "older": sum(older_by_cat.values()),
                          "publishers": sorted({p["name"] for p in NEWS_PUBLISHERS if not p.get("keep_source")})})
_STOP = set("what is are was were the a an of in on at to for with about and or how why when who did does do now happening happened latest news update updates going there this that it its has have had been be new".split())
def _ask_terms(q):
    words = [w for w in re.findall(r"[a-z0-9][a-z0-9'-]+", q.lower()) if w not in _STOP and len(w) > 1]
    return words[:6]
@app.post("/api/news/ask")
def news_ask():
    """'What is happening now with X?' — answered from today's stories plus everything remembered about X."""
    if not news_user(): return jsonify(error="Please sign in."), 401
    q = str((request.get_json(silent=True) or {}).get("question") or "").strip()[:200]
    terms = _ask_terms(q)
    if not terms: return jsonify(error="Ask about something specific — a place, a person, a company."), 400
    query = " ".join(terms)
    fresh, at = news_items(query)                                           # today's stories (also remembered from now on)
    con = db()
    like = " AND ".join("lower(title) LIKE ?" for _ in terms[:3])
    hist = [dict(r) for r in con.execute(f"SELECT link,title,source,published,snippet FROM news_items WHERE {like} AND published >= ? ORDER BY published DESC LIMIT 120",
                                        tuple(f"%{t}%" for t in terms[:3]) + ((datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=NEWS_KEEP_DAYS)).isoformat(),))]
    con.close()
    items = _merge(fresh[:40], hist, 60)
    if not items: return jsonify(ok=True, question=q, answer=f"I have nothing on “{query}” yet — not in today's news and nothing remembered. Try other words, or follow it as a topic and I'll start keeping track.", sources=[], fetched_at=at)
    first = min(i.get("published") or "9999" for i in items)[:10]
    if not os.environ.get("OPENAI_API_KEY"): return jsonify(error="Answering needs the AI key on the server."), 503
    lines = "\n".join(f"- [{(i.get('published') or '')[:16].replace('T',' ')}] {i['title']} ({i.get('source','')})" + (f" — {i['snippet'][:140]}" if i.get("snippet") else "") for i in sorted(items, key=lambda i: i.get("published") or "", reverse=True))
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%A, %B %-d, %Y")
    try:
        from openai import OpenAI
        r = OpenAI().chat.completions.create(model=os.environ.get("OPENAI_MODEL", "gpt-5.1"), max_completion_tokens=600,
            messages=[{"role": "system", "content": f"Today is {today}. You answer a parent's question about the news using ONLY the dated headlines provided (timestamps are UTC). "
                       "Structure: 1) 'Right now:' two or three sentences on the latest state, naming dates. 2) 'How it got here:' a short dated timeline, oldest first, only if there is history older than today. "
                       "3) 'Watch for:' one line. Plain English, no hype, mention outlets in brackets, never invent facts not in the headlines; if the headlines are thin, say so."},
                      {"role": "user", "content": f"Question: {q}\nStories remembered since {first} and today's:\n{lines}"}])
        answer = r.choices[0].message.content.strip()
    except Exception as e:                                                 # noqa: BLE001
        return jsonify(error=f"The answer didn't come through ({type(e).__name__})."), 502
    return jsonify(ok=True, question=q, query=query, answer=answer, remembered_since=first, sources=items[:25], fetched_at=at)

@app.get("/api/news/past")
def news_past():
    """Everything older than three days for a topic or a front-page category, newest first, 150 at a time."""
    if not news_user(): return jsonify(error="Please sign in."), 401
    topic = str(request.args.get("topic") or "").strip()[:60]
    try: offset = max(0, int(request.args.get("offset") or 0))
    except ValueError: offset = 0
    key = ("front:" + topic) if topic in NEWS_CATS else topic.lower()
    cutoff = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=NEWS_RECENT_DAYS)).isoformat()
    con = db()
    total = con.execute("SELECT COUNT(*) FROM news_items WHERE topic=? AND published < ?", (key, cutoff)).fetchone()[0]
    rows = [dict(r) for r in con.execute("SELECT link,title,source,category,published,snippet FROM news_items WHERE topic=? AND published < ? ORDER BY published DESC LIMIT 150 OFFSET ?", (key, cutoff, offset))]
    saved = {r["link"] for r in con.execute("SELECT link FROM news_saved WHERE user_key=?", (news_user(),))}
    con.close()
    rows = _merge(rows, [], 150)
    for it in rows: it["seen"] = True; it["saved"] = it["link"] in saved
    return jsonify(ok=True, topic=topic, total=total, offset=offset, items=rows, cutoff=cutoff)

@app.get("/api/news/search")
def news_search():
    """A one-off look-up: fresh stories for any words, without following them."""
    if not news_user(): return jsonify(error="Please sign in."), 401
    q = str(request.args.get("q") or "").strip()[:80]
    if len(q) < 2: return jsonify(error="Type a word or two to search."), 400
    items, at = news_items(q)
    return jsonify(ok=True, query=q, fetched_at=at, items=items[:40])
@app.post("/api/news/topics")
def news_topics_edit():
    u = news_user()
    if not u: return jsonify(error="Please sign in."), 401
    x = request.get_json(silent=True) or {}; con = db()
    if x.get("add"):
        t = str(x["add"]).strip()[:60]
        if t and not con.execute("SELECT 1 FROM news_topics WHERE user_key=? AND topic=? COLLATE NOCASE", (u, t)).fetchone():
            n = con.execute("SELECT COUNT(*) FROM news_topics WHERE user_key=?", (u,)).fetchone()[0]
            if n >= 20: con.close(); return jsonify(error="Twenty topics is plenty — remove one first."), 400
            con.execute("INSERT INTO news_topics(user_key,topic,position,created_at) VALUES(?,?,?,?)", (u, t, n, now_iso()))
    if x.get("remove"): con.execute("DELETE FROM news_topics WHERE user_key=? AND topic=? COLLATE NOCASE", (u, str(x["remove"])[:60]))
    if isinstance(x.get("order"), list):
        for i, t in enumerate(x["order"][:20]): con.execute("UPDATE news_topics SET position=? WHERE user_key=? AND topic=?", (i, u, str(t)[:60]))
    con.commit(); topics = _news_topics(con, u); con.close()
    return jsonify(ok=True, topics=topics)
@app.post("/api/news/seen")
def news_seen():
    u = news_user()
    if not u: return jsonify(error="Please sign in."), 401
    links = [str(l)[:2000] for l in ((request.get_json(silent=True) or {}).get("links") or [])][:200]
    con = db(); now = now_iso()
    con.executemany("INSERT OR IGNORE INTO news_seen(user_key,link,seen_at) VALUES(?,?,?)", [(u, l, now) for l in links])
    con.execute("DELETE FROM news_seen WHERE user_key=? AND seen_at < ?", (u, (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=30)).isoformat()))
    con.commit(); con.close(); return jsonify(ok=True)
@app.post("/api/news/save")
def news_save():
    u = news_user()
    if not u: return jsonify(error="Please sign in."), 401
    x = request.get_json(silent=True) or {}; con = db()
    if x.get("remove"): con.execute("DELETE FROM news_saved WHERE user_key=? AND link=?", (u, str(x["remove"])[:2000]))
    else:
        it = x.get("item") or {}
        con.execute("INSERT OR REPLACE INTO news_saved(user_key,link,title,source,published,topic,saved_at) VALUES(?,?,?,?,?,?,?)",
                    (u, str(it.get("link"))[:2000], str(it.get("title"))[:300], str(it.get("source") or "")[:100], str(it.get("published") or "")[:40], str(x.get("topic") or "")[:60], now_iso()))
    con.commit(); con.close(); return jsonify(ok=True)
@app.post("/api/news/summary")
def news_summary():
    u = news_user()
    if not u: return jsonify(error="Please sign in."), 401
    topic = str((request.get_json(silent=True) or {}).get("topic") or "").strip()[:60]
    if topic.startswith("front:"):
        front, at = news_frontpages(); items = front.get(topic[6:], [])
    else:
        items, at = news_items(topic)
    if not items: return jsonify(error="Nothing to summarize yet."), 404
    con = db(); row = con.execute("SELECT text, made_at FROM news_summaries WHERE topic=? AND fetched_at=?", (topic.lower(), at)).fetchone(); con.close()
    if row: return jsonify(ok=True, summary=row["text"], made_at=row["made_at"], cached=True)
    if not os.environ.get("OPENAI_API_KEY"): return jsonify(error="The summary needs the AI key on the server."), 503
    heads = "\n".join(f"- {it['title']} ({it['source']})" for it in items[:25])
    try:
        from openai import OpenAI
        client = OpenAI()
        r = client.chat.completions.create(model=os.environ.get("OPENAI_MODEL", "gpt-5.1"), max_completion_tokens=350,
            messages=[{"role": "system", "content": "You write a calm, plain-English briefing for a busy parent. 4 short bullet points max, each one sentence, no hype, no links. Group related headlines. End with one line: what to watch next."},
                      {"role": "user", "content": f"Topic: {topic}\nToday's headlines:\n{heads}"}])
        text = r.choices[0].message.content.strip()
    except Exception as e:                                             # noqa: BLE001
        return jsonify(error=f"The summary didn't come through ({type(e).__name__})."), 502
    con = db(); con.execute("INSERT OR REPLACE INTO news_summaries(topic,fetched_at,text,made_at) VALUES(?,?,?,?)", (topic.lower(), at, text, now_iso())); con.commit(); con.close()
    return jsonify(ok=True, summary=text, made_at=now_iso(), cached=False)


@app.get("/play/latin")
def play_latin():
    return _nocache(send_from_directory(GAMES_DIR / "elemental-latin", "index.html", max_age=0))

@app.get("/play/elementum")
def play_elementum():
    return _nocache(send_from_directory(GAMES_DIR / "elementum", "index.html", max_age=0))

@app.get("/play/elementum/<path:name>")
def play_elementum_asset(name):
    if not name.endswith((".js", ".png", ".webp", ".json")) or ".." in name:
        return jsonify(error="Not found."), 404
    return send_from_directory(GAMES_DIR / "elementum", name, max_age=0)

@app.get("/play/latin/<path:name>")
def play_latin_asset(name):
    # the game's own files next to index.html: the 3D library and the scene code
    if not name.endswith((".js", ".png", ".webp", ".json")) or ".." in name:
        return jsonify(error="Not found."), 404
    return send_from_directory(GAMES_DIR / "elemental-latin", name, max_age=0)

@app.get("/play/zsy")
def play_zsy():
    return _nocache(send_from_directory(GAMES_DIR / "zheng-shang-you", "index.html", max_age=0))

@app.get("/play/quest")
def play_quest():
    return _nocache(send_from_directory(GAMES_DIR / "critter-quest", "index.html", max_age=0))

@app.get("/play/fifa/<path:fname>")
def play_fifa_files(fname):
    return _nocache(send_from_directory(FIFA_DIR, fname, max_age=0))

@app.get("/logo.png")
def company_logo():
    return send_from_directory(IMG_DIR, "logo.png")

@app.get("/favicon.png")
def company_favicon():
    return send_from_directory(IMG_DIR, "favicon.png")

@app.get("/api/health")
def health():
    return jsonify(status="ok",database=str(DB.name),time=now_iso())

def book_key():
    """The book a logged-in member owns: derived from their login, never from the
    browser. None on this Mac when nobody is logged in (family device)."""
    em = (session.get("email") or "").strip().lower()
    em = re.sub(r"[^a-z0-9@._+-]", "", em)
    nm = (session.get("name") or "").strip()
    if not session.get("authed") or not (em or nm):
        return None
    return "book_" + re.sub(r"[^a-z0-9]+", "_", (em or nm).lower()).strip("_")[:60]

def owns_book(user_id):
    k = book_key()
    return k is None or user_id in (k, "me") or is_owner()

@app.post("/api/transcripts")
def transcript():
    x=request.get_json(force=True)
    x["userId"]=book_key() or x.get("userId")
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
    x["userId"]=book_key() or x.get("userId")
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
    x["userId"]=book_key() or x.get("userId")
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
    if not owns_book(user_id):
        return jsonify(error="That is someone else's book."), 403
    if user_id == "me" or (book_key() and not is_owner()):
        user_id = book_key() or user_id
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
    k = book_key()
    if k:                                   # logged in: only this login's book, never anyone else's
        keep = set()
        for r in con.execute("SELECT signature_file, image_file FROM receipts WHERE user_id=?", (k,)):
            keep.update(x for x in r if x)
        for t in ("transcripts", "receipts", "journal", "audit_log"):
            con.execute(f"DELETE FROM {t} WHERE user_id=?", (k,))
        con.commit(); con.close()
        for name in keep:
            try: (FILES / name).unlink()
            except OSError: pass
        return jsonify(ok=True, book=k)
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
    slug = book_key() or safe_slug(x.get("profileId"), "profile")
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
    if book_key() and not is_owner():
        prefix = book_key()                          # your login, your book — nobody else's
    if not prefix:
        return jsonify(error="No profile given."), 400
    files = sorted(BACKUPS.glob(f"{prefix}_*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
    if not files and book_key():                     # first login after the change: seed from the old name-based copy
        legacy = safe_slug((session.get("name") or "").replace(" ", "_"), "")
        if legacy:
            files = sorted(BACKUPS.glob(f"{legacy}_*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
    if not files:
        return jsonify(found=False)
    return jsonify(found=True, name=files[0].name, data=json.loads(files[0].read_bytes()))

@app.get("/api/backups")
def list_backups():
    pat = f"{book_key()}_*.json" if (book_key() and not is_owner()) else "*.json"
    files = sorted(BACKUPS.glob(pat), key=lambda f: f.stat().st_mtime, reverse=True)
    return jsonify(files=[{"name": f.name, "bytes": f.stat().st_size,
                           "modified": datetime.datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="seconds")}
                          for f in files])

@app.get("/api/backup/<name>")
def get_backup(name):
    if safe_slug(name.replace(".json", ""), "") + ".json" != name:
        return jsonify(error="Bad name."), 400
    if book_key() and not is_owner() and not name.startswith(book_key() + "_"):
        return jsonify(error="That is someone else's book."), 403
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
