# Hardy Wu — the company

Everything that runs hardywu.com and what it sells. One folder per kind of thing:

| Folder | What it is | Runs on | Address |
|---|---|---|---|
| `corporate/` | The company system: sign-in, people, orders, print queue, visitor activity, the office pages. One server, one database. | this Mac today, Google Cloud Run next | api / office / log*.hardywu.com, plus play. and bookkeep. until the front-ends move to Cloudflare |
| `site/` | The public website hardywu.com and the shop (`site/shop`). | Cloudflare (pages), this Mac (shop, port 3010) | hardywu.com, shop.hardywu.com |
| `products/games/` | The games, one folder each. | served by corporate today | play.hardywu.com |
| `products/apps/` | Apps for sale: BookKeep. | served by corporate today | bookkeep.hardywu.com |
| `products/prints/` | 3D-printed goods for sale: models, print settings, photos, write-ups. | files only | sold through the shop |

Everything outside `company/` (the sensor kit, manuals, LLM from Scratch, PCB Agent, One Man Tower, Card game leftovers) is the workshop: learning and R&D, never on GitHub.

## How to start things on this Mac
- Server: double-click `corporate/Start BookKeep.command` (or `cd corporate && .venv/bin/python server.py`). Log: `/private/tmp/bookkeep_server.log`.
- Shop: `cd site/shop && npx next start -p 3010`. Log: `/private/tmp/hardyshop.log`.
- Internet: the Cloudflare tunnel `bookkeep` forwards hardywu.com addresses to ports 5000 and 3010.
- Website pages: `python3 site/build.py` regenerates `site/www/`; `cd site && npx wrangler deploy` publishes it.

## Rules
See `AGENTS.md`. Short version: read a folder's README, PRD, TASKS and TESTING before touching it; update TASKS and run TESTING before you say you are done; never commit `corporate/data/` or `.env`; remove test people and test orders from real data.

## Status
- 2026-09-10: folders reorganised into this layout (was BookKeep/, fifa/, Games/, www/, tools/, Hardy's 3D Business/). Behaviour unchanged.
- Next: move corporate and the shop to Google Cloud Run (waiting on the hardywu.com domain verification), then split `corporate/server.py` into modules (login, people, sales, crm, production, analytics, admin), then one GitHub repository per product.
