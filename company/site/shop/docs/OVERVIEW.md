# 3D Print Shop — Custom 3D-Printed Products Store

A website where customers can browse Barbara's 3D-printed products, customize them
(color, size, custom text, and/or an uploaded image), pay by card, and place an order.
Every completed order is emailed to **barbaratao@gmail.com** with all customization
details so Barbara can print and ship it.

**The owner (Barbara) is not technical.** Any agent working on this project makes all
technical decisions independently and communicates with the owner in plain,
non-technical language. Never ask the owner a technical question — decide and document.

## Folder map

| Folder / file | What it is |
|---|---|
| `docs/PRD.md` | Product requirements — what to build and what "success" means. **Read first.** |
| `docs/TASKS.md` | The build plan, in order, with checkboxes and acceptance criteria. |
| `docs/TESTING.md` | Manual test scripts that must pass before launch. |
| `design/mock.html` | Design mockup of every screen. **Must be approved by the owner before any real UI is built.** |
| `assets/products/` | The owner's real product photos and `product-list.md` (the catalog she fills in). |
| `app/` | The actual website code lives here. Empty until the mock is approved. |

## Current status

- [x] Project scaffold, PRD, tasks, testing docs created
- [x] `design/mock.html` approved by owner (2026-08-14)
- [x] Owner inputs collected — catalog of 31 products, colors, shipping, about text
- [x] Website built in `app/` and verified locally, incl. demo-mode orders (2026-08-14)
- [ ] Deploy to Vercel + owner's Stripe & Resend accounts  ← **we are here**
- [ ] Testing per `docs/TESTING.md` on the live link
- [ ] Launch

## Definition of success (from the owner)

> Someone enters the website link, customizes a product, orders and pays
> successfully, and that order arrives in my Gmail so I can print the product.

If a step of the plan doesn't serve that sentence, cut it.
