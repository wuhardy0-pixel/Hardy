# app/ — the Hardy's 3D website

Next.js app. Built 2026-08-14 against the approved `design/mock.html`.

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

- `src/app/page.js` — homepage: hero, product grid, About section.
- `src/app/products/[slug]/page.js` + `src/components/Customizer.js` — product page:
  color swatches (shop-wide palette), "want a color you don't see?" request box,
  custom text (≤30 chars), optional/required image upload, quantity, live total.
  Choices are kept in sessionStorage so a cancelled checkout doesn't lose them.
- `src/app/api/upload/route.js` — validates JPG/PNG/HEIC ≤10 MB; stores in Vercel
  Blob when `BLOB_READ_WRITE_TOKEN` is set, else `public/uploads/` (local dev).
- `src/app/api/checkout/route.js` — creates a Stripe Checkout session (flat $5 US
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
