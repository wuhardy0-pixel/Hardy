"""Generate the www/ folder: the hardywu.com front page and sections as plain files,
so Cloudflare Pages can serve www.hardywu.com straight from GitHub.

It renders the pages with the site's own code (no second copy to maintain), then
points anything that needs the running server — games, BookKeep, the store,
sign-in, Hardy's report — at hardywu.com / the login addresses.

Run from the repo root:  python3 tools/build_www.py
"""
import os, re, shutil, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "www"
os.environ["BOOKKEEP_DATA_DIR"] = tempfile.mkdtemp()      # never touch the real books
os.environ.setdefault("BOOKKEEP_SECRET", "build-only")
sys.path.insert(0, str(ROOT / "BookKeep")); os.chdir(ROOT / "BookKeep")
import server                                                # noqa: E402

BASE = "https://www.hardywu.com"
LIVE = "https://hardywu.com"
c = server.app.test_client()

def clean(html):
    html = html.replace('<script src="/track.js" defer></script>', "")   # no visit tracking on the static copy
    return html

def page(path, dest):
    r = c.get(path, base_url=BASE)
    if r.status_code != 200:
        raise SystemExit(f"{path} → {r.status_code}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(clean(r.get_data(as_text=True)))
    return dest

def file(path, dest):
    r = c.get(path, base_url=BASE)
    if r.status_code != 200:
        raise SystemExit(f"{path} → {r.status_code}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(r.get_data())

shutil.rmtree(OUT, ignore_errors=True); OUT.mkdir()
pages = [page("/", OUT / "index.html")]
for sec, sdef in server.PORTFOLIO.items():
    if sec == "3d":
        continue                                          # the 3D section IS the store → redirect below
    pages.append(page(f"/{sec}", OUT / sec / "index.html"))
    for slug, it in sdef["items"].items():
        if it.get("redirect"):
            continue                                      # BookKeep → its login address (redirect below)
        pages.append(page(f"/{sec}/{slug}", OUT / sec / f"{slug}.html"))
for img in ("/logo.png", "/favicon.png"):
    file(img, OUT / img.lstrip("/"))
for name in ("apps", "games", "3d", "robotics"):
    file(f"/sec/{name}.jpg", OUT / "sec" / f"{name}.jpg")
for m in sorted(set(re.findall(r'"/item/([^"]+)"', "".join(p.read_text() for p in pages)))):
    file(f"/item/{m}", OUT / "item" / m)

# everything that needs the running server lives on hardywu.com
redirects = [
    "/apps/bookkeep  https://logbook.hardywu.com/  302",
    f"/3d            {server.SHOP_HOST}  302",
    f"/3d/*          {server.SHOP_HOST}/products/:splat  302",
    f"/play/*        {LIVE}/play/:splat  302",
    f"/go/*          {LIVE}/go/:splat  302",
    f"/activity      {LIVE}/activity  302",
    f"/signout       {LIVE}/signout  302",
    f"/api/*         {LIVE}/api/:splat  307",
]
(OUT / "_redirects").write_text("\n".join(redirects) + "\n")
(OUT / "404.html").write_text((ROOT / "tools" / "404.html").read_text())
leftovers = [p.name for p in pages if "/track.js" in p.read_text() or 'fetch("/api/' in p.read_text()]
print(f"www/: {len(pages)} pages, {sum(1 for _ in OUT.rglob('*') if _.is_file())} files"
      + (f"  (still server-bound: {leftovers})" if leftovers else ""))
