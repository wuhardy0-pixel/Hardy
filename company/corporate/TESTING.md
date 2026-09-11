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
