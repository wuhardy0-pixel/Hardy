# corporate — the company system

Status: **live** (this Mac, moving to Google Cloud Run).

One Flask program, `server.py`, with one SQLite database in `data/`. It does:
- **Sign-in** for everything (games, shop, BookKeep, office pages): name + email, no passwords yet. Hosts `log*.hardywu.com`.
- **People**: the members table (customers, discounts), visitor activity (`data/activity.json`).
- **Sales**: orders from the site and the shop (`/api/order`, `/api/order/from-shop`), status ordered → printed → shipped → returned / cancelled, booked tick.
- **Production**: the print queue, one job per order (`/api/print-jobs`).
- **Office pages**: `/orders` and `/activity` for Hardy.
- **BookKeep's back end**: transcripts, journal, receipts, backups per login (`book_<email>`), the AI agent (OpenAI key in `.env`).
- Today it also serves the BookKeep front-end (`products/apps/bookkeep`), the games (`products/games`) and the site pages; those move to Cloudflare later.

## Run
```
cd company/corporate
.venv/bin/python server.py            # or double-click "Start BookKeep.command"
curl http://127.0.0.1:5000/api/health
```
First time: `python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt`, and copy `.env.example` to `.env`.

## Data (`data/`, never in git)
`bookkeep_v13.db` (orders, print_jobs, members, transcripts, journal, receipts, audit_log), `backups_v13/` (one JSON per book per day), `evidence_files_v13/`, `activity.json`.

## Deploy
`gcloud run deploy hardywu --source company` from the repo root (Dockerfile, start.sh, Caddyfile in `company/`). See `docs/` and `../../.claude` memory for the Cloud Run project.

## Planned split (no behaviour change)
`login/`, `people/`, `sales/`, `crm/`, `production/`, `inventory/`, `finance/`, `analytics/`, `admin/` as modules plugged into `app.py`.
