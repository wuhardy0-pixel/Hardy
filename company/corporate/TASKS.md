# corporate — done and next

## 2026-09-15
- Email verification at sign-in: `/api/visitor` and `/api/login` now email a 6-digit code (`/api/verify`, `/api/verify/resend`); both sign-in pages got the code screen. Trusted emails survive sign-out. Sender = Gmail app password (MAIL_USER/MAIL_PASSWORD) or RESEND_API_KEY in `.env`; with neither, the real site skips the step and this Mac returns the code in the API reply for tests. **Waiting on Barbara for the Gmail app password to switch it on.**

## 2026-09-10
- Moved here from `BookKeep/`. Data now in `data/`; BookKeep front-end, games and site images served from their new folders. No behaviour change; all routes checked, smoke test passed.
- Earlier today: print queue (`print_jobs`), order statuses ordered/printed/shipped/returned/cancelled with a separate `booked` tick; unified sign-in; one book per login.

## Next
- Cloud Run cut-over (blocked on Barbara verifying hardywu.com in Google Search Console).
- Split `server.py` into modules; move the Orders tab out of BookKeep into office pages.
- Put the Gmail app password in `corporate/.env` (MAIL_USER, MAIL_PASSWORD) and restart; then codes go out for real.

History before 2026-09-10: see `../products/apps/bookkeep/TASKS.md` (the server and the app shared one file).
