# site — done and next

## 2026-09-10
- Moved from `tools/build_www.py` + `www/` + `worker.js` to this folder; rebuilt `www/`, identical output.

## Next
- Move the page text out of the server into files here.
- Serve the games and the BookKeep front-end from Cloudflare as well, so only corporate needs a server.

## 2026-09-26
- /3d and /3d/* forward to the store directly.
- `/.well-known/ucp` published as a real file (UCP platforms must not be redirected); `/ucp/*`, `/order/*`, `/terms` forward to play.hardywu.com.
- Static site now publishes robots.txt, llms.txt, products.json, openapi.json, sitemap.txt (all generated from the server by build.py) and schema.org Organization + product list JSON-LD on the front page. /products/* and /api/* forward to play.hardywu.com. Shop product pages carry schema.org Product JSON-LD; shop has a robots.txt.
- 2026-10-29 Hardy + Barbara: front page opens on the Shop like Amazon (product photos + prices), then Video Games; 3D + Robotics merged as 'Shop'; Apps hidden from the public (pages still work, family emails see an 📱 Apps link).
- 2026-10-29 Hardy: theme 'not blue, not dark, not too bright' → warm sand theme (sand ground, cream panels, dark-brown text, terracotta accent, olive Buy Now) on hardywu.com, sign-in page and the store.
- 2026-10-29 Hardy: coin system. Suggestions (💬 button or /coins) earn 10 coins when Hardy approves on /feedback (25 for a great idea, or none); 100 coins = a free small print (price ≤ $15: crab gauge, ruler, skeleton), which goes into orders + print queue as source 'coins' at $0. Balance in the sign-in bar and /api/me.
- 2026-10-29 'don't add coins yet': coin system switched OFF (COINS_ON = False in corporate/server.py). Nothing shows: no banner, no balance, no buttons on /feedback, /coins and /api/coins/* closed. Flip the flag + restart + rebuild www to open it.
