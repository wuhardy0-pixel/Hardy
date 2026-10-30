# corporate — how to prove it works

Server must be running on 127.0.0.1:5000. Real hosts force https, so send `-H "X-Forwarded-Proto: https"` with any `Host:` header.

```
B=http://127.0.0.1:5000
curl -s $B/api/health                                         # {"status":"ok",...}
curl -s -H "Host: hardywu.com" -H "X-Forwarded-Proto: https" $B/       # site home, 200
curl -s -H "Host: logbook.hardywu.com" -H "X-Forwarded-Proto: https" $B/   # sign-in page, 200
curl -s $B/play/nova | head -c 200 ; curl -s $B/play/fifa/ | head -c 200   # games load
curl -s $B/api/orders?all=1 ; curl -s $B/api/print-jobs               # owner only (local counts as owner)
```
Order flow (local = owner): POST `/api/order` with `{"product":"crab-gauge","qty":1,"buyer":"Flow Test","color":"Black"}` → a print job appears in `/api/print-jobs` → POST `/api/print-jobs/update` `{"id":..,"status":"done"}` → the order is `printed` → POST `/api/orders/update` `{"id":..,"status":"shipped"}`. Then delete the test order, its job, and any test member.

Sign-in across products: sign in on logbook.hardywu.com, then bookkeep.hardywu.com/api/whoami must return the name; /logout must sign out of the games too.

Pass = every call above returns 200 and the flow completes; no rows for test people remain.

## Sign-in code (from this Mac, no mail configured → the reply contains the code)
```
H='-H Host:logbook.hardywu.com -H X-Forwarded-Proto:https -H Content-Type:application/json'; J=/tmp/j
curl -s -c $J -b $J $H -X POST $B/api/visitor -d '{"name":"Code Test","email":"codetest@example.com"}'   # {"verify":true,"code":"123456",...}
curl -s -c $J -b $J $H -X POST $B/api/verify -d '{"code":"000000"}'    # 400, didn't match
curl -s -c $J -b $J $H -X POST $B/api/verify -d '{"code":"123456"}'    # ok, next=...
curl -s -b $J $H $B/api/whoami                                          # name = Code Test
```
Then delete the test member and its activity entry. With MAIL_USER/MAIL_PASSWORD set, sign in on logbook.hardywu.com with your own email and check the code arrives within a minute.

## Feedback
Sign in (cookie jar) on logbook.hardywu.com, then with Host play.hardywu.com POST `/api/feedback` `{"message":"…","playing":"Nova Blast","path":"/play/nova","opened_at":"<iso>","played_seconds":120,"device":"phone"}` → `{"ok":true}`; not signed in → 401. `GET /api/feedback` from this Mac lists rows; `/feedback` as Hardy shows them. In a browser, the 💬 button must open a box in each game and typing must not steer or pause the game. Delete the test rows afterwards (`DELETE FROM feedback WHERE email='…'`).

## Universal Commerce Protocol
Run `.venv/bin/python tests/ucp_flow.py` from corporate/ (server on :5000). It covers the profile, the MCP handshake and tools, cart add/change/remove, checkout from cart, complete → requires_escalation, the 30-second approval code (fresh link unlocks, stale link refused), the buyer's Approve → completed order, and cleans up. Pass = no FAIL lines.

Older manual steps:
Run `.venv/bin/python` on the script in corporate/tests/ucp_flow.py (Host play.hardywu.com): create session with `crab-gauge__black` → incomplete with missing buyer.email and address; PUT buyer + US address → ready_for_complete, total 1500; complete → completed with order; GET /ucp/orders/{id} → ordered; the order row has source agent, ship_to, and a print job. The script deletes its test order and sessions.


## Store orders, your orders, reviews (2026-10-28)
From this Mac: POST `/api/order/from-shop` with `ship_to`, `phone`, `email` → the order row carries them (Hardy's Orders tab shows the address). With a signed-in cookie jar: GET `/api/orders/mine` lists that email's orders (401 without); GET `/api/reviews/<slug>` is open and returns `{reviews,count,average}`; POST it `{stars,title,body}` signed in → one review per person per product (a second post replaces). Delete test orders (and their print_jobs) and test reviews afterwards.

## Office and staff (2026-10-29)
Run `.venv/bin/python tests/office_flow.py` from corporate/. It works on a copy of the database (nothing real changes) and covers: office.hardywu.com sign-in page, customers and "typed Hardy's name" refused, the three roles (owner / manager / printer), staff sign-ins expiring after 7 days, "sign out everywhere", the last-owner guard, staff always needing a code, and Google sign-in (Google's reply is faked). Pass = `ALL PASS`.

Note: since 2026-10-29 the server emails sign-in codes (Resend), so the code is no longer handed back in the API reply. `tests/ucp_flow.py` signs in a test buyer that way and fails its three "signed-in buyer" steps against the live server; run it against a copy started without RESEND_API_KEY.

## Playground (2026-10-29)
Signed in (cookie jar): GET /api/playground/projects → {projects, helper:{left,free,resets}}; POST it {title, model, colors, ...} → {id}; POST /api/playground/helper ten times → the 11th is 429; POST /api/playground/projects/delete {id}. Not signed in → 401. Then delete the test rows (playground_projects, playground_helper WHERE email=…).
