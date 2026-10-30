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
- 2026-10-29 Theme = the little cat's colours (cream #f6ead8, ginger #f2a65a buttons with brown #4a2e24 text, brown ink #5b3a2e, pale blue #9fd0e8/#d6ebf5 second colour, pink #f4978e 'low' badges) on hardywu.com, sign-in and the store; cat picture taken off the site.
- 2026-10-29: Theme changed to the logo's colours (navy #032859, teal #02848d, orange #f8991d on white) on hardywu.com, the store (navy header) and the office; www/ rebuilt.
- 2026-10-29: Website design mocks in site/mocks/ (A–C own designs; D–F from the UI UX Pro Max skill data). Not live; waiting for Barbara and Hardy to choose.
- 2026-10-29: Combined prototype in site/mocks/v2/ (Home = mock A hero; Make your own = mock E steps + mock B live lid; Shop = mock F clay + B printing headline + C turntable bestsellers; Games). New model: shop ready-made, 3D playground (pay when you print), games; no apps for now.
- 2026-10-29: Prototype v2 reworked: one clay style for every page (mocks/v2/clay.css: Nunito + DM Sans, shared sizes, warm cream ground); home compass in clay; Make your own = sign-in → My projects → 6-step studio (pick, colours, name, picture, AI helper chat with a daily free limit, print), each step with its own animation. Helper replies are simulated.
- 2026-10-29: Style switch on every prototype page (mocks/v2/theme.js): "Cozy" warm clay or "Space" (mock A night sky, planets, Unbounded + Instrument Sans). All colours/fonts in clay.css are variables; the choice is saved on the device.
- 2026-10-29: Space style keeps the Cozy lettering (Nunito + DM Sans, same sizes); only colours and the night sky change (Barbara).
- 2026-10-29: Landing page (Barbara): no "Made by Hardy Wu" line; compass W point = Apps (BookKeep & more → /apps); buttons "Make your own 3D products" / "Shop ready-made 3D products". www rebuilt.
- 2026-10-29: Landing headline = "Hardy's 3D: you design it, Hardy prints it." (Barbara chose); "Try new things." kept as a small slogan under the lead.
- 2026-10-29: "Apps" added to the top menu beside Games (site and store), Barbara.
- 2026-10-29: Apps renamed "AI Apps" (menu + compass "powered by AI"); items "AI Bookkeeping" and "AI News Tracker"; the two mid-page bubbles moved to the edges (Barbara).
- 2026-10-29: Section pages (AI Apps, Games) lose the "← hardywu.com" link (Barbara); the logo goes home. Style files load with a version tag so browsers never show a stale copy.
