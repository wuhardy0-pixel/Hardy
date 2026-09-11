# site — hardywu.com

Status: **live** on Cloudflare (Worker `hardy`, files in `www/`).

- `build.py` asks the server for each public page (home, games, apps, robotics, 3D) and writes them as plain files into `www/`. Run `python3 site/build.py` after any page change, then `cd site && npx wrangler deploy`.
- `images/` holds the section and item pictures, logo and favicon the pages use (served by the server as /sec/, /item/, /logo.png).
- `worker.js` + `wrangler.jsonc`: the Cloudflare Worker that serves `www/` and forwards www.hardywu.com to hardywu.com; `404.html` is the not-found page.
- `shop/`: the online store (Next.js), shop.hardywu.com — see `shop/README.md` and `shop/docs/`.

The page text itself still lives inside `corporate/server.py` (the portfolio routes); moving it into real page files here is planned.
