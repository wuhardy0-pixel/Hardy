# PRD — 3D Print Shop

**Owner:** Barbara (barbaratao@gmail.com) — **non-technical**. All technical decisions
are delegated to the implementing agent. Talk to the owner only about business
questions (products, prices, look & feel), always in plain language.

**Date:** 2026-08-14 · **Currency:** USD · **Status:** Approved scope, awaiting mock approval

---

## 1. What we're building

A public e-commerce website for the owner's 3D-printed products. Customers can:

1. Browse a small catalog of products (real photos, prices in USD).
2. Customize a product before buying — any combination of, per product:
   - **Color** — pick from the filament colors the owner offers for that product.
   - **Size** — pick from options the owner defines (sizes can change the price).
   - **Custom text** — type a name/date/message to be printed on the product.
   - **Image upload** — upload their own image (e.g., for a lithophane/photo print).
3. Pay by **card at checkout** (Stripe).
4. Receive an on-screen and email confirmation.

After a successful payment, an **order email is sent to barbaratao@gmail.com**
containing everything the owner needs to print and ship — with no follow-up
questions to the customer.

## 2. Success criteria (the whole point)

The project succeeds when this is true, end to end, on the live public link:

> A stranger opens the website link on their phone or computer, picks a product,
> customizes it, pays with a card, and within ~2 minutes an email arrives at
> **barbaratao@gmail.com** containing: what they ordered, every customization
> choice, a working link to any uploaded image, what they paid, and the
> customer's name, email, and shipping address.

`docs/TESTING.md` turns this into concrete pass/fail tests. All must pass before launch.

## 3. Users

- **Customer** — anyone with the link. No account, no login. Must work on mobile.
- **Owner** — receives orders by email only. No admin dashboard in v1. The owner's
  "admin panel" is her Gmail inbox.

## 4. Functional requirements

### 4.1 Catalog & product pages
- Products come from a simple, editable data file built from
  `assets/products/product-list.md` (the owner fills that in; the agent converts it).
- Each product: name, photos, description, base price (USD), and which of the four
  customization types it offers (each product can offer any subset).
- Products flagged **Multicolored: yes** in their `info.md` must say clearly on
  the product page that the item is printed in multiple colors as shown (owner
  request 2026-08-14); the color choice then applies as described on the product.
- Product page shows a live **price that updates** as options change, and an
  **order summary** of chosen options before checkout.

### 4.2 Customizer rules
- **Colors by part (owner decision 2026-08-14):** every product defines named
  color zones (lunchbox: Box / Lid / Name; ruler & crab gauge: Body / Markings) and
  the customer picks a color **per zone** from the shop-wide palette in
  `assets/products/shop-info.md`. Only the FIRST zone is required — other zones
  default to "same color" (owner decision 2026-08-14). One color is included;
  **each additional distinct color costs +$2** (see 4.2b).
  Every product also has an optional **"Want a color you don't see?"** box; its
  contents go into the order email and the owner decides feasibility before printing.
- **Interactive live preview (owner decisions 2026-08-14/15):** the product picture
  updates live as the customer customizes — per-zone recoloring (pre-rendered
  neutral base + per-zone masks, tinted in a browser canvas), and the typed text
  and uploaded picture appear on the product in the preview. The preview is
  **rotatable** (drag to spin through 12 pre-rendered angles). Products whose
  customization prints on the back (ruler, crab gauge) have a **"Show back"**
  flip that reveals the name/picture where it will actually be printed
  (lunchbox: on the lid). A gallery of real photos remains available alongside.

### 4.2b Add-on pricing (owner decision 2026-08-14, rate lowered to $2 same day; applies to every product)
- +$2 if the customer adds custom text
- +$2 if the customer adds an uploaded picture
- +$2 for each distinct color beyond the first (e.g., 3 colors = +$4)
- **Text color** (owner 2026-08-17): the custom text has its own color choice,
  shown only once text is typed; a different text color counts as an extra
  color (+$2). The palette includes **Transparent (clear)** filament, shown as a
  checkerboard swatch.
- Products where customization prints small (ruler, crab gauge backs) show a
  clear warning once a picture is uploaded: it prints a few centimeters wide,
  simple images work best (owner 2026-08-17).
- Add-ons are per unit and multiply with quantity; the server recomputes the
  price from the chosen options (never trusts the browser's total).
- **Size:** labeled options (e.g., Small 10 cm — $24). Price differences shown on the
  option itself. Required if offered.
- **Custom text:** single line, max 30 characters, shown with a live preview of the
  text. Optional unless the owner marks it required for that product. Strip
  leading/trailing spaces; reject empty-if-required.
- **Image upload:** only on products whose `info.md` marks it (decided by owner
  2026-08-14 — not every product). Clear "Upload an image" button. JPG/PNG/HEIC,
  max 10 MB. Show a thumbnail preview after upload. The file must be stored
  somewhere durable and privately linkable so the order email can include a
  working download link. Required if the product is upload-based (e.g., photo lamp).
- Invalid states (missing required choice, bad file type, too-long text) show a
  clear, friendly message and block checkout.

### 4.3 Checkout & payment
- **Stripe Checkout** (Stripe's hosted payment page) — minimizes what we build and
  handles card security for us.
- Collect: customer name, email, **shipping address** (Stripe Checkout's built-in
  shipping address collection).
- Shipping cost: flat rate — ask the owner for the amount during input collection
  (business question, allowed). Default to a flat $5 within the US if she has no
  preference.
- On success: friendly confirmation page ("We got your order — you'll hear from
  Barbara soon"). On cancel/failure: return to the product with choices preserved.

### 4.4 Order email (the critical feature)
Triggered by **confirmed payment** (Stripe webhook — never by the customer merely
reaching the confirmation page). Sent to `barbaratao@gmail.com`.

- **Subject:** `New order #<number> — <product name> — $<total>`
- **Body must include:** order number & date; product name; every customization
  choice by name (color, size, exact custom text in quotes); a working link to the
  uploaded image if any; quantity; amount paid incl. shipping; customer name,
  email, phone (if given), full shipping address.
- Reliability: if the email fails to send, retry; the order must never be silently
  lost. Orders should also be recoverable from the Stripe dashboard as a backstop.
- Also send the **customer** a short confirmation email (nice-to-have, not launch-blocking).

### 4.5 Other pages
- Simple About/Contact section (owner's shop name + contact email) — can live on the
  homepage. No blog, no extra pages.

## 5. Out of scope for v1
Customer accounts/login, order-management dashboard, inventory tracking, discount
codes, multiple currencies, reviews, live 3D preview of models, shipping-rate
calculators, analytics. Don't build these even if easy — launch first.

## 6. Recommended implementation (agent may adjust; document any changes)
- **Next.js** app deployed on **Vercel** (free tier, gives a public `*.vercel.app` link —
  satisfies "enter the website link" without buying a domain; a custom domain can
  be added later if the owner wants).
- **Stripe Checkout** for payment; **Stripe webhook** → order processing.
- **Resend** (or similar) for sending the order email.
- **Vercel Blob** (or similar) for image uploads.
- Product catalog as a checked-in JSON/TS data file — no database needed in v1.
- Test mode first (Stripe test cards per `docs/TESTING.md`), then switch to live keys.

## 7. What the owner must provide (collect before building — plain language only)
1. **Product info** → `assets/products/` has one folder per product (auto-created
   2026-08-14 from her `Documents/3D` projects, photos already copied in). She fills
   each product's `info.md` (price, description, options; "Sell this? no" excludes it).
2. **Shop-wide settings** → she fills `assets/products/shop-info.md`: shop name,
   filament color list (the customer-facing palette), flat shipping price, about text.
3. **Stripe account** → she must create one at stripe.com (needs her ID and bank
   details so payments reach her bank). Walk her through it step by step; the agent
   handles all keys/configuration.

Her design/print files live in `Documents/3D` (one folder per project with
`work files/` + `upload/`). The website only ever uses photos and listing info —
never copy or publish her .stl/.3mf/design files.

## 8. Process constraints
- `design/mock.html` must be **approved by the owner before building any real UI**.
  If she requests changes, update the mock and get re-approval.
- Ask the owner when a *business* decision could hurt the project; never guess.
  Never ask her technical questions — decide, and note the decision in this file.
