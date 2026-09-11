# corporate — done and next

## 2026-09-10
- Moved here from `BookKeep/`. Data now in `data/`; BookKeep front-end, games and site images served from their new folders. No behaviour change; all routes checked, smoke test passed.
- Earlier today: print queue (`print_jobs`), order statuses ordered/printed/shipped/returned/cancelled with a separate `booked` tick; unified sign-in; one book per login.

## Next
- Cloud Run cut-over (blocked on Barbara verifying hardywu.com in Google Search Console).
- Split `server.py` into modules; move the Orders tab out of BookKeep into office pages.
- Decide on a PIN/password.

History before 2026-09-10: see `../products/apps/bookkeep/TASKS.md` (the server and the app shared one file).
