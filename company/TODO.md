# Company to-do, in order

Last updated 2026-09-10. Any person or AI picking up work starts here, then reads the
folder's README / PRD / TASKS / TESTING before touching it (see AGENTS.md). When a step
is done, mark it, date it, and add a line to that folder's TASKS.md.

| # | Task | Who | Status |
|---|------|-----|--------|
| 1 | **Verify hardywu.com with Google.** Search Console → Add property → Domain → hardywu.com → paste the TXT record to the AI, which adds it to Cloudflare DNS → click Verify. Needed before Google will attach hardywu.com addresses to Cloud Run. | Barbara | waiting |
| 2 | **Push the current code to Google Cloud Run.** `gcloud run deploy hardywu --source company` (project hardywu-site-758a, region us-central1, service hardywu). Barbara must approve the command. | AI | not started |
| 3 | **Move the live system to Google Cloud.** Copy `corporate/data/` to the bucket, map bookkeep / books / shop / play / log*.hardywu.com to Cloud Run, switch Cloudflare DNS, confirm sign-in, orders, print queue and BookKeep books work, then stop the server and the shop on the Mac. | AI | blocked by 1 |
| 4 | **Serve the games and the BookKeep pages from Cloudflare.** Static files from `products/games/*` and `products/apps/bookkeep/`, with sign-in still checked by corporate. Afterwards corporate stands alone. | AI | not started |
| 5 | **Split `corporate/server.py` into modules.** login, people, sales, crm, production, analytics, admin + app.py / db.py / settings.py. Same behaviour; run corporate/TESTING.md before and after. Move the Orders tab out of BookKeep into an office page (office.hardywu.com). | AI | not started |
| 6 | **GitHub organisation + one repository per product.** Name to confirm (suggested: hardywu). Repositories: corporate, site, bookkeep, nova-blast, critter-quest, football-sim, funny-monsters, dodge, math-game, prints. Keep history (git subtree split); old wuhardy0-pixel/Hardy becomes the read-only archive. | AI, Barbara picks the name | not started |
| 7 | **Sign-in security.** Today anyone typing Hardy's email becomes Hardy. Decide: 4-digit PIN, password, or email link. Then build it in corporate/login. | Barbara decides, AI builds | waiting |
| 8 | **Printer connection.** Send finished print jobs from the queue to the 3D printer automatically. Needs the printer's make and model and whether it is on the same Wi-Fi. Each product also needs a sliced, ready-to-print file. | Hardy/Barbara answer, AI builds | waiting |
| 9 | **Missing game sources.** Nova Strike, Pokémon Adventure, C-Mind FreeCell and LearnTopia are on itch.io; their project files are not in this folder. Find them, add folders under products/games, and serve them from hardywu.com. | Hardy | waiting |
| 10 | **Office pages one at a time:** inventory, crm, finance, analytics. Each is a new folder in corporate plus a page in admin, following the pattern of sales + production. | AI, when Barbara asks | not started |
| 11 | **Decide on One Man Tower.** The folder in Hardy/ is a teardown of another studio's game, kept for study only. If Hardy builds his own tower game, name it and create its folder under products/games. | Barbara/Hardy | waiting |

## Done
- 2026-09-10 — Reorganised into company/ (corporate, site, products) with standard docs; behaviour unchanged. Print queue and real order statuses live. One sign-in for everything. One BookKeep book per login.
