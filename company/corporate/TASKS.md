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
- **Sign-in email code now expires after 30 seconds** (`VERIFY_SECONDS`; was 10 minutes) — Barbara's rule. An expired code keeps the attempt alive so 'Send a new code' works. Approval links (`continue_url`) carry a private code that lives as long as the checkout (6 h); a stale or guessed link shows only 'This link has expired'.
- UCP round two: **MCP transport** at `/ucp/mcp` (JSON-RPC 2.0: initialize, tools/list, tools/call; 13 tools = the UCP methods; bare method names also accepted); **carts** (`/ucp/carts` create/get/update/cancel, full-replacement update = add/change/remove; checkout from `cart_id`, one active checkout per cart); **buyer approval**: a checkout never completes by API — status `requires_escalation` with `continue_url` = `/approve/<id>`, where the buyer (signed in with the buyer email, or Hardy) sees the summary and presses Approve; then the order + print job are created and the agent's `get_checkout` shows `completed`. Test: `tests/ucp_flow.py` (23 checks).
- hardywu.com/3d and /3d/<product> now go straight to shop.hardywu.com (no sign-in to browse); sign-in happens at checkout.
- Products can be out of stock (`in_stock` in the shop catalog): /api/order, /api/agent/order and UCP checkout refuse them, the feed/llms.txt/site say sold out. Lunchbox is sold out as of today.
- Universal Commerce Protocol (ucp.dev, the Shopify/Google standard) implemented in server.py: profile `/.well-known/ucp` (version 2026-08-25; capabilities catalog.search, catalog.lookup, checkout, fulfillment; payment_handlers empty = no online payment), REST at `/ucp`: catalog/search, catalog/lookup, catalog/product, checkout-sessions create/get/update/complete/cancel, orders/{id}. Variant ids are `<slug>__<colour>`. Sessions in `ucp_sessions` (6-hour expiry). Completing creates orders (source='agent', agent = UCP-Agent header) + print jobs. New human pages: /order/<id> (permalink) and /terms. Spec copy studied from github.com/Universal-Commerce-Protocol/ucp.
- Outage: the tunnel and the shop had died on the Mac (Cloudflare error 1033 on logquest). Restarted, then installed launchd jobs `com.hardywu.server`, `com.hardywu.shop`, `com.hardywu.tunnel` (~/Library/LaunchAgents) that start at login and restart on crash. Logs in /tmp/com.hardywu.*.log. Restart one with `launchctl kickstart -k gui/$(id -u)/com.hardywu.server`.
- AI shopping agents: public `GET /api/products` (ACP-style feed), `GET /openapi.json`, `/llms.txt`, `/robots.txt`, and `POST /api/agent/order` (no sign-in; buyer name+email, colour, qty, ship_to, phone, agent; 10/hour per IP). Orders get source='agent' + ship_to/phone/agent columns, a print job, and an email to Barbara when mail is configured. /orders and the BookKeep Orders tab show them.
- Another assistant reported shop.hardywu.com 'blocking' its browser tool. Diagnosis: Cloudflare Browser Integrity Check → error 1010 for unusual user agents (Python-urllib reproduces it; a datacenter fetch with a normal UA is fine). Needs a Cloudflare dashboard change (TODO 13). Added a visible 'AI assistants → llms.txt' line + <link rel=alternate/help> to every site page and the shop so agents that read the human pages find the catalogue.
- Barbara: 'the Shopify repo on GitHub is what it should be'. Studied Shopify/claude-for-commerce-examples (storefront agent that shops any domain serving /.well-known/ucp) and Shopify/shop-chat-agent. Made Hardy's store compatible with Shopify's own agent code: the shop domain now serves `/.well-known/ucp`, `/api/ucp/mcp` and `/api/mcp` (Next.js proxies → corporate; header X-Hardy-Public-Host makes the profile advertise the shop's endpoints; X-Hardy-Client-IP keeps rate limits per visitor); new tool `search_shop_policies_and_faqs` (FAQ from shop_faq()); `get_product` with a variant id answers as that selected variant; quantity 0 removes a cart line; every open checkout carries its private link; the approval page is a full hosted checkout (buyer fills name/phone/address if the agent did not; email = sign-in). Proof: `tests/shopify_agent_smoke.py` runs Shopify's backend against shop.hardywu.com — discovery, search, details, cart add/update/remove, checkout hand-off, policies all pass.

