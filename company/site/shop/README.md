# shop/ — the Hardy's 3D store (shop.hardywu.com)

Next.js 14 app, run on this Mac by the `com.hardywu.shop` launchd job (`next start -p 3010`) behind the Cloudflare tunnel.
Rebuilt 2026-10-28 as a marketplace-style store (Hardy: 'set it up like Amazon'): dark header with search, account,
'Returns & Orders' and a cart; category bar; home with a hero, category tiles and product cards; search results with
filters (category, price, personalization) and sort; product pages with a thumbnail gallery, 'About this item' bullets,
the customizer (colors with low-stock badges, name, picture — in the live preview the buyer **drags the picture and the name** to where they want them and sets their size; the placement is saved with the order), a sticky **buy box** (delivery estimate, quantity, Add to Cart,
Buy Now) and customer reviews; a cart page; a checkout (who it's for, shipping address, payment note, review items);
'Your orders'; and a thank-you page.

## Run it locally

```bash
npm install
npm run dev        # → http://localhost:3000
```

`npm run dev` / `npm run build` first regenerate the catalog: `scripts/build-catalog.mjs`
parses `../assets/products/*/info.md` + `../assets/products/shop-info.md` into
`data/catalog.json` and copies product photos into `public/products/`. To change
products, prices, or colors, edit those markdown files and rebuild — no code changes.

## How it works

- `src/components/Header.js` — search box (→ `/s?k=`), sign-in state from `/api/me`, cart count. `src/lib/cart.js` — the cart (localStorage, `useCart()`).
- `src/app/s/page.js` — search/browse with filters. `src/app/cart/page.js`, `src/app/checkout/page.js`, `src/app/orders/page.js` — cart, checkout, your orders (client pages).
- `src/app/api/me`, `api/my-orders`, `api/reviews/[slug]` — thin proxies to Hardy's server on 127.0.0.1:5000 (`/api/me`, `/api/orders/mine`, `/api/reviews/<slug>`), forwarding the shopper's cookie.
- `data/catalog.json` is edited by hand now (the old `../assets/products` markdown source is gone; `scripts/build-catalog.mjs` skips itself when that folder is missing). Per product: `in_stock`, `category`, `bullets`. Per color: `stock` = `plenty` | `low` (shown as a 'low' badge and a note on the product page). Shop-wide: `shippingCents` (0 = free shipping, the words change everywhere), `addons` (dollars for a name, a picture, each extra colour), `costing` + each product's `cost` (the cost sheet, see docs/COSTS.md and Hardy's page at play.hardywu.com/costs). **To change what's in stock or the filament levels, edit this file and run `npm run build`, then `launchctl kickstart -k gui/$(id -u)/com.hardywu.shop`.**

- `src/app/page.js` — homepage: hero, product grid, About section.
- `src/app/products/[slug]/page.js` + `src/components/Customizer.js` — product page:
  color swatches (shop-wide palette), "want a color you don't see?" request box,
  custom text (≤30 chars), optional/required image upload, quantity, live total.
  Choices are kept in sessionStorage so a cancelled checkout doesn't lose them.
- `src/app/api/upload/route.js` — validates JPG/PNG/HEIC ≤10 MB; stores in Vercel
  Blob when `BLOB_READ_WRITE_TOKEN` is set, else `public/uploads/` (local dev).
- `src/app/api/checkout/route.js` — takes the whole cart + the address. Without `STRIPE_SECRET_KEY` (today) it records one order per cart line on Hardy's server (`/api/order/from-shop` with ship_to, phone, email; $5 shipping on the first line), emails, and shows the thank-you page: no card online, Hardy emails the buyer to arrange payment. With a Stripe key it creates a Stripe Checkout session (flat $5 US
  shipping, collects name/email/phone/shipping address; customization in session
  metadata). **Demo mode:** with no `STRIPE_SECRET_KEY`, it skips payment, sends
  the order email anyway, and redirects to the thank-you page — so the whole flow
  is testable before the owner's Stripe account exists.
- `src/app/api/webhook/route.js` — `checkout.session.completed` → order email to
  the owner (and confirmation to the customer) via `src/lib/orderEmail.js`.
  Email failure → 500 → Stripe retries; orders are never silently lost. Without
  `RESEND_API_KEY`, emails are logged to the server console instead.

## Environment

See `.env.example`. The app runs with zero env vars (demo mode). For launch:
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, and (on Vercel)
`BLOB_READ_WRITE_TOKEN`.

## Still to do (see ../docs/TASKS.md)

Deploy to Vercel · owner's Stripe account + live keys · Resend setup ·
run ../docs/TESTING.md · launch test order.
