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

## 2026-09-16
- Sign-in pages ask "Playing on: 📱 Phone / 💻 Computer" (pre-picked by auto-detect); the choice is kept in the session and handed to the browser as the hw_device cookie for all of hardywu.com, so every game starts with the right controls. Changeable in each game's pause menu.

## 2026-09-21
- Feedback: 💬 button in every game (lives in track.js). Saves to the `feedback` table: name, email, what they were playing, when they opened the game, how long they had played, when they sent it, phone/computer, message. Hardy reads it at hardywu.com/feedback (link in the sign-in bar next to orders) or `/api/feedback`; Barbara also gets an email once the mail sender is configured.

## 2026-09-26
- Outage: the tunnel and the shop had died on the Mac (Cloudflare error 1033 on logquest). Restarted, then installed launchd jobs `com.hardywu.server`, `com.hardywu.shop`, `com.hardywu.tunnel` (~/Library/LaunchAgents) that start at login and restart on crash. Logs in /tmp/com.hardywu.*.log. Restart one with `launchctl kickstart -k gui/$(id -u)/com.hardywu.server`.
- AI shopping agents: public `GET /api/products` (ACP-style feed), `GET /openapi.json`, `/llms.txt`, `/robots.txt`, and `POST /api/agent/order` (no sign-in; buyer name+email, colour, qty, ship_to, phone, agent; 10/hour per IP). Orders get source='agent' + ship_to/phone/agent columns, a print job, and an email to Barbara when mail is configured. /orders and the BookKeep Orders tab show them.

